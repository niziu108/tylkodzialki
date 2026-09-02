import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import * as ftp from "basic-ftp";
import { prisma } from "../src/lib/prisma";

// CZUJKA NOWYCH BIUR na drop-zonie FTP.
//
// Po co: Galactica/ASARI mają nas jako "portal predefiniowany". Biuro klika eksport u siebie w CRM,
// jego CRM zakłada NOWY katalog na naszym wspólnym koncie FTP i zaczyna tam wrzucać paczki.
// Silnik importu chodzi WYŁĄCZNIE po katalogach zapisanych w CrmIntegration.ftpRemotePath,
// więc taki katalog może leżeć tygodniami i nikt go nie zaimportuje. Biuro widzi, że "portal nie działa".
//
// Ten skrypt NICZEGO nie zmienia: łączy się po listę katalogów i porównuje ją z bazą.
//
// Użycie:
//   npm run crm:nowe            # konta współdzielone (>=2 integracje) — tam trafiają nowe biura
//   npm run crm:nowe -- --all   # wszystkie konta FTP, także dedykowane
//   npm run crm:nowe -- --json  # surowy JSON (do maila/admina)
//   npm run crm:nowe -- --all --mail   # dla crona: mail na CRM_ALERT_EMAIL tylko gdy coś znajdzie

const SCAN_ALL = process.argv.includes("--all");
const AS_JSON = process.argv.includes("--json");
const SEND_MAIL = process.argv.includes("--mail");

// Katalogi techniczne CRM-ów (ASARI trzyma tu zdjęcia) — nigdy nie są nowym biurem.
const IGNOROWANE_KATALOGI = new Set(["pictures", "images", "zdjecia", "zdjęcia", "photos", "img", "tmp", "temp"]);

function normPath(p: string | null | undefined): string {
  const s = (p ?? "").trim().replace(/[\u005C]/g, "/");
  const cut = s.replace(/^\/+/, "").replace(/\/+$/, "");
  return cut.toLowerCase();
}

type Account = {
  host: string;
  port: number;
  user: string;
  password: string;
  passive: boolean;
  integrations: { id: string; name: string; provider: string; path: string; lastSuccessAt: Date | null }[];
};

type NewDir = {
  konto: string;
  katalog: string;
  plikow: number;
  mb: number;
  najnowszyPlik: string | null;
  dniOdOstatniegoPliku: number | null;
};

async function main() {
  const integrations = await prisma.crmIntegration.findMany({
    where: { transportType: "FTP" },
    select: {
      id: true, name: true, provider: true, isActive: true,
      ftpHost: true, ftpPort: true, ftpUsername: true, ftpPassword: true,
      ftpRemotePath: true, ftpPassive: true, lastSuccessAt: true,
    },
  });

  const accounts = new Map<string, Account>();
  for (const i of integrations) {
    if (!i.ftpHost || !i.ftpUsername || !i.ftpPassword) continue;
    const key = `${i.ftpHost}|${i.ftpUsername}`;
    const acc = accounts.get(key) ?? {
      host: i.ftpHost, port: i.ftpPort ?? 21, user: i.ftpUsername,
      password: i.ftpPassword, passive: i.ftpPassive, integrations: [],
    };
    acc.integrations.push({
      id: i.id, name: i.name, provider: i.provider,
      path: normPath(i.ftpRemotePath), lastSuccessAt: i.lastSuccessAt,
    });
    accounts.set(key, acc);
  }

  // Wszystkie znane ścieżki i nazwy kont (bez domeny) — do odsiania dubletów katalogów
  // tego samego biura na innym koncie.
  const wszystkieSciezki = new Set(
    integrations.map((i) => normPath(i.ftpRemotePath)).filter(Boolean)
  );
  const kontaBezDomeny = new Set(
    integrations
      .map((i) => (i.ftpUsername ?? "").split("@")[0].trim().toLowerCase())
      .filter(Boolean)
  );

  const toScan = [...accounts.values()].filter((a) => SCAN_ALL || a.integrations.length >= 2);

  if (!AS_JSON) {
    console.log(`Kont FTP w bazie: ${accounts.size} | skanuję: ${toScan.length}${SCAN_ALL ? " (wszystkie)" : " (współdzielone)"}\n`);
  }

  const nowe: NewDir[] = [];
  const puste: { konto: string; biuro: string; katalog: string; powod: string }[] = [];

  for (const acc of toScan) {
    const client = new ftp.Client(30_000);
    client.ftp.verbose = false;
    try {
      await client.access({
        host: acc.host, port: acc.port, user: acc.user,
        password: acc.password, secure: false,
      });

      // Integracja z pustą ścieżką ("/") obsługuje CAŁE konto (silnik sam schodzi do podkatalogów),
      // więc na takim koncie nic nie jest "niczyje" — pomijamy je, inaczej czujka krzyczy o
      // katalogi biur, które importują się poprawnie.
      if (acc.integrations.some((i) => i.path === "")) {
        continue;
      }

      const znane = new Set(acc.integrations.map((i) => i.path).filter(Boolean));
      const list = await client.list("/");
      const katalogi = list.filter((e) => e.isDirectory);

      for (const dir of katalogi) {
        const nazwa = normPath(dir.name);
        if (!nazwa || nazwa === "." || nazwa === "..") continue;
        if (znane.has(nazwa)) continue;
        if (IGNOROWANE_KATALOGI.has(nazwa)) continue;
        // Katalog o nazwie biura, które mamy już podpięte na INNYM koncie (np. dublet po
        // przenosinach ze wspólnego konta na dedykowane) — nie jest nowym biurem.
        if (wszystkieSciezki.has(nazwa) || kontaBezDomeny.has(nazwa)) continue;

        let plikow = 0;
        let bytes = 0;
        let najnowszy: Date | null = null;
        let najnowszaNazwa: string | null = null;
        try {
          const pliki = await client.list(`/${dir.name}`);
          for (const f of pliki) {
            if (f.isDirectory) continue;
            plikow += 1;
            bytes += f.size ?? 0;
            const d = f.modifiedAt ?? null;
            if (d && (!najnowszy || d > najnowszy)) { najnowszy = d; najnowszaNazwa = f.name; }
          }
        } catch {
          // brak wejścia do katalogu — i tak raportujemy sam fakt jego istnienia
        }

        nowe.push({
          konto: acc.user,
          katalog: dir.name,
          plikow,
          mb: Math.round((bytes / 1024 / 1024) * 10) / 10,
          najnowszyPlik: najnowszaNazwa,
          dniOdOstatniegoPliku: najnowszy ? Math.floor((Date.now() - najnowszy.getTime()) / 86_400_000) : null,
        });
      }

      // Odwrotna kontrola: integracja wskazuje katalog, którego na FTP już nie ma.
      const naFtp = new Set(katalogi.map((d) => normPath(d.name)));
      for (const i of acc.integrations) {
        if (i.path && !naFtp.has(i.path)) {
          puste.push({ konto: acc.user, biuro: i.name, katalog: i.path, powod: "katalog nie istnieje na FTP" });
        }
      }
    } catch (e) {
      console.error(`BŁĄD połączenia (${acc.user}):`, e instanceof Error ? e.message : e);
    } finally {
      client.close();
    }
  }

  nowe.sort((a, b) => (a.dniOdOstatniegoPliku ?? 9999) - (b.dniOdOstatniegoPliku ?? 9999));

  if (AS_JSON) {
    console.log(JSON.stringify({ nowe, puste }, null, 2));
    process.exit(0);
  }

  if (nowe.length === 0) {
    console.log("✅ Brak niepodłączonych katalogów. Każdy folder na drop-zonie ma swoją integrację.");
  } else {
    console.log(`🔔 NIEPODŁĄCZONE KATALOGI (biuro wysyła, my NIE importujemy): ${nowe.length}\n`);
    console.log("  dni  plików     MB  konto                          katalog");
    for (const n of nowe) {
      const dni = n.dniOdOstatniegoPliku === null ? "  ?" : String(n.dniOdOstatniegoPliku).padStart(3);
      console.log(
        `  ${dni}  ${String(n.plikow).padStart(6)}  ${String(n.mb).padStart(6)}  ${n.konto.padEnd(28)}  ${n.katalog}`
      );
    }
    console.log("\n  (dni = ile dni temu wpadł ostatni plik; 0-2 = biuro wysyła TERAZ, pilne)");
  }

  if (puste.length > 0) {
    console.log(`\n⚠️  Integracje wskazujące na nieistniejący katalog: ${puste.length}`);
    for (const p of puste) console.log(`   ${p.biuro} -> /${p.katalog} (${p.konto})`);
  }

  // Mail wychodzi TYLKO gdy jest o czym pisać — cichy dzień nie generuje poczty.
  if (SEND_MAIL && nowe.length > 0) {
    const to = process.env.CRM_ALERT_EMAIL || process.env.ADMIN_EMAIL;
    if (!to) {
      console.error("\n❌ --mail: ustaw CRM_ALERT_EMAIL (albo ADMIN_EMAIL) w env.");
    } else {
      const { sendMail } = await import("../src/lib/mailer");
      const wiersze = nowe
        .map(
          (n) =>
            `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb"><b>${n.katalog}</b></td>` +
            `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${n.konto}</td>` +
            `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${n.plikow} plików / ${n.mb} MB</td>` +
            `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${
              n.dniOdOstatniegoPliku === null ? "?" : `${n.dniOdOstatniegoPliku} dni temu`
            }</td></tr>`
        )
        .join("");
      await sendMail({
        to,
        subject: `TylkoDziałki: ${nowe.length} nowe biuro/biura na FTP czeka na podłączenie`,
        html:
          `<p>Na drop-zonie FTP leżą katalogi, których <b>nie importuje żadna integracja</b>. ` +
          `To zwykle biuro, które właśnie zaznaczyło nas w swoim CRM.</p>` +
          `<table style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">` +
          `<tr><th align="left" style="padding:6px 10px">katalog</th><th align="left" style="padding:6px 10px">konto FTP</th>` +
          `<th align="left" style="padding:6px 10px">zawartość</th><th align="left" style="padding:6px 10px">ostatni plik</th></tr>` +
          wiersze +
          `</table>` +
          `<p style="margin-top:16px">Podłączenie: <a href="https://tylkodzialki.pl/admin/crm">/admin/crm</a> ` +
          `→ nowa integracja z tym kontem FTP i ścieżką <code>/nazwa-katalogu</code>.</p>`,
        text: nowe
          .map((n) => `${n.katalog} (${n.konto}) — ${n.plikow} plików, ostatni ${n.dniOdOstatniegoPliku ?? "?"} dni temu`)
          .join("\n"),
      });
      console.log(`\n📧 Wysłano powiadomienie na ${to}`);
    }
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
