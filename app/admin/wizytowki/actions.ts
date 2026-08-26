"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth-options";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { slugifyBiuro } from "@/lib/biuroWizytowka";

/* Wizytówki biur edytujemy WYŁĄCZNIE tutaj. Biuro nie dostaje panelu do zarządzania nią:
 * chce zmiany, pisze do nas maila. Jedno miejsce edycji = brak rozjazdu i brak ryzyka,
 * że partner sam wstawi sobie coś, czego nie chcemy publikować pod naszą marką. */

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const currentUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (!currentUser || currentUser.role !== "ADMIN") redirect("/");
  return currentUser;
}

function optionalText(formData: FormData, key: string, max = 400) {
  const raw = String(formData.get(key) || "").trim();
  return raw ? raw.slice(0, max) : null;
}

/* Adres www partnera. Wpisujemy go ręcznie i zwykle „na sucho" („polnoc.pl"), więc brak
 * schematu dopisujemy sami — inaczej przeglądarka potraktowałaby link jako względny
 * i wysłała kupującego na nieistniejącą podstronę naszego serwisu. Wszystko, co nie
 * wygląda na adres http(s), odrzucamy zamiast zapisywać śmieć w linku wychodzącym. */
function optionalUrl(formData: FormData, key: string) {
  const raw = String(formData.get(key) || "").trim();
  if (!raw) return null;

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Domena musi mieć kropkę i część po niej: „polnoc" to literówka, nie adres.
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return null;
    return url.toString().slice(0, 300);
  } catch {
    return null;
  }
}

function optionalInt(formData: FormData, key: string, min: number, max: number) {
  const raw = String(formData.get(key) || "").replace(/\D/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** Wolny slug wywiedziony z nazwy biura; przy kolizji dokleja -2, -3, ... */
async function wolnySlug(base: string, userId: string) {
  const root = slugifyBiuro(base) || "biuro";

  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const taken = await prisma.user.findFirst({
      where: { biuroSlug: candidate, NOT: { id: userId } },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `${root}-${userId.slice(-6)}`;
}

export async function saveWizytowkaAction(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("userId") || "");
  if (!userId) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, biuroSlug: true, defaultBiuroNazwa: true, name: true },
  });
  if (!user) return;

  const on = String(formData.get("wizytowkaOn") || "") === "1";

  // Nazwa biura bierze się normalnie z feedu przy pierwszym imporcie, ale świeże konto
  // partnera jeszcze jej nie ma (a `name` to zwykle imię osoby, która je zakładała).
  // Puste pole zostawia to, co już jest — nie kasujemy nazwy przez przypadek.
  const nazwa = optionalText(formData, "nazwa", 160);

  // Slug ustalamy raz, przy pierwszym włączeniu, i już go nie ruszamy — link mógł
  // pójść do partnera mailem, więc zmiana nazwy biura nie może go zepsuć. Ręczna
  // korekta jest możliwa polem „Adres wizytówki", ale to świadoma decyzja admina.
  // Adres wklejony przez pomyłkę (np. URL logo) dałby slug w rodzaju
  // „https-www-m2-nieruchomosci-pl-logo-webp". Takie wejście odrzucamy i wracamy
  // do wyliczenia adresu z nazwy biura.
  const wygladaJakAdres = (v: string) => /^https?:\/\//i.test(v) || /^https?-/.test(v) || v.includes("/");

  const slugPole = String(formData.get("slug") || "").trim();
  const slugChciany = wygladaJakAdres(slugPole) ? "" : slugifyBiuro(slugPole);
  const slugObecny = user.biuroSlug && !wygladaJakAdres(user.biuroSlug) ? user.biuroSlug : null;

  let slug = slugObecny;

  if (slugChciany && slugChciany !== slugObecny) {
    slug = await wolnySlug(slugChciany, userId);
  }

  // Brak adresu przy włączaniu wizytówki (albo naprawa po powyższej pomyłce): liczymy
  // go z nazwy biura. Adres raz ustalony zostaje, bo link mógł już pójść do partnera.
  if (on && !slug) {
    slug = await wolnySlug(nazwa || user.defaultBiuroNazwa || "biuro", userId);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(nazwa ? { defaultBiuroNazwa: nazwa } : {}),
      biuroWizytowkaOn: on,
      biuroPartnerStrategiczny: String(formData.get("partnerStrategiczny") || "") === "1",
      biuroSlug: slug,
      biuroOpis: optionalText(formData, "opis", 4000),
      biuroTelefon: optionalText(formData, "telefon", 40),
      biuroEmail: optionalText(formData, "email", 160),
      biuroAdres: optionalText(formData, "adres", 200),
      biuroWww: optionalUrl(formData, "www"),
      biuroRokZalozenia: optionalInt(formData, "rokZalozenia", 1900, 2100),
      biuroLiczbaOddzialow: optionalInt(formData, "liczbaOddzialow", 1, 10000),
    },
  });

  revalidatePath("/admin/wizytowki");
  revalidatePath(`/admin/wizytowki/${userId}`);
  if (slug) revalidatePath(`/biuro/${slug}`);
  // Znak partnera pojawia się przy KAŻDEJ ofercie biura, nie tylko na wizytówce,
  // więc samo odświeżenie karty partnera zostawiłoby stare listy w cache.
  revalidatePath("/kup");
  revalidatePath("/");

  // Wracamy na listę: zapis zwykle kończy pracę nad jednym kontem, a na liście od razu
  // widać nowy status i link „Podejrzyj".
  redirect("/admin/wizytowki");
}

/* Wyróżnienia przyznane z ręki: pakiet startowy dla partnera, którego nie da się kupić
 * w checkoucie (bo nie ma być kupiony — to element negocjacji, nie pozycja w cenniku).
 * Saldo trafia na to samo pole co zakup przez Stripe, więc biuro wydaje je normalnie
 * w swoim panelu: jedno wyróżnienie = jedno ogłoszenie na 7 dni.
 *
 * Ujemna liczba odbiera. Poniżej zera nie schodzimy, żeby pomyłka w polu nie zrobiła
 * z salda długu, którego biuro nie ma jak spłacić.
 *
 * Data ważności jest twarda: `wyroznijOgloszenieAction` odmawia wydania punktów po jej
 * upływie. Bez tego obietnica „pakiet wygasa po trzech miesiącach" byłaby pusta. */
export async function przyznajWyroznieniaAction(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("userId") || "").trim();
  if (!userId) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, featuredCredits: true },
  });
  if (!user) return;

  const raw = String(formData.get("liczba") || "").trim();
  const delta = Number.parseInt(raw, 10);

  if (!Number.isFinite(delta) || delta === 0) {
    redirect(`/admin/wizytowki/${userId}?wyroznienia=blad`);
  }

  // Jednorazowy limit na wpis, żeby zgubione zero nie rozdało tysiąca wyróżnień.
  if (Math.abs(delta) > 500) {
    redirect(`/admin/wizytowki/${userId}?wyroznienia=blad`);
  }

  const nowe = Math.max(0, (user.featuredCredits ?? 0) + delta);

  const dni = optionalInt(formData, "waznoscDni", 1, 3650);
  const wygasa = dni ? new Date(Date.now() + dni * 24 * 60 * 60 * 1000) : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      featuredCredits: nowe,
      // Puste pole „ważność" zostawia dotychczasową datę w spokoju: korekta salda
      // (np. odjęcie jednego punktu) nie powinna po cichu przedłużać pakietu.
      ...(dni ? { featuredCreditsExpiresAt: wygasa } : {}),
    },
  });

  revalidatePath(`/admin/wizytowki/${userId}`);
  revalidatePath("/panel");
  redirect(`/admin/wizytowki/${userId}?wyroznienia=ok`);
}

