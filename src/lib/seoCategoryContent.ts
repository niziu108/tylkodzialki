// P21: generowanie UNIKALNEJ treści lokalnej i FAQ na stronach kategorii
// /dzialki/[miasto]/[typ] z realnych danych (CategoryDetail z seoHub).
//
// Cel SEO: każda strona ma inny, konkretny tekst zbudowany z liczb z naszej bazy,
// więc Google nie widzi „cienkiej/zduplikowanej" treści. Zero zmyślania: gdy próbka
// za mała (pola `null` w CategoryDetail), piszemy uczciwie „za mało ofert", a nie
// mylącą średnią ([[feedback-filtry-twarde]]). Zakresy są percentylowe (p10..p90),
// więc pojedyncze śmieciowe ogłoszenie nie zaniża „od".
//
// Język: poprawna polska odmiana miast (gen/loc + wPrep z seo-locations), ZERO długich
// myślników, konkret zamiast ogólników ([[feedback-copy-style]]).

import type { CategoryDetail, RangeStat } from '@/lib/seoHub';
import { formatIntPL, formatPLN } from '@/lib/format';
import { inCity, type SeoCity, type SeoType, type SeoRegion } from '@/lib/seo-locations';

export type SpecRow = { label: string; value: string };
export type FaqItem = { question: string; answer: string };

function pln(v: number): string {
  return formatPLN(v);
}

function m2(v: number): string {
  return `${formatIntPL(v)} m²`;
}

function zlM2(v: number): string {
  return `${formatIntPL(v)} zł/m²`;
}

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function range(stat: RangeStat, fmt: (n: number) => string): string {
  if (stat.low === stat.high) return fmt(stat.low);
  return `od ${fmt(stat.low)} do ${fmt(stat.high)}`;
}

// Mianownik typu w l. poj. rodz. żeński do „działka ___" (budowlane → budowlana).
function typFem(type: SeoType): string {
  return type.adj.replace(/e$/, 'a');
}

// Dopełniacz l. mn. przymiotnika do „działek ___" (budowlane → budowlanych, rolne → rolnych).
function adjGen(type: SeoType): string {
  return type.adj.replace(/e$/, 'ych');
}

// „X od osób prywatnych, Y z biur" z obsługą skrajnych przypadków (0 prywatnych / 0 biur).
function fromWhoText(detail: CategoryDetail): string {
  if (detail.officeCount === 0) return 'wszystkie od właścicieli prywatnych';
  if (detail.privateCount === 0) return 'wszystkie od biur nieruchomości';
  return `${formatIntPL(detail.privateCount)} od osób prywatnych i ${formatIntPL(detail.officeCount)} od biur`;
}

// Stabilny wybór wariantu szablonu na podstawie sluga (ten sam tekst przy każdym renderze
// tej samej strony, różny między stronami) — drobna anty-duplikacja struktury zdań.
function pickVariant(seed: string, count: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % count;
}

// ── Wiersze danych (blok specyfikacji obok opisu) ──────────────────────────────
export function buildSpecRows(detail: CategoryDetail): SpecRow[] {
  const rows: SpecRow[] = [];

  rows.push({ label: 'Aktywne oferty', value: formatIntPL(detail.count) });

  if (detail.count > 0) {
    const fromWho =
      detail.officeCount === 0
        ? 'wyłącznie prywatne'
        : detail.privateCount === 0
          ? 'wyłącznie biura'
          : `${formatIntPL(detail.privateCount)} prywatnych, ${formatIntPL(detail.officeCount)} z biur`;
    rows.push({ label: 'Od kogo', value: fromWho });
  }

  if (detail.pricePerM2) {
    rows.push({ label: 'Przeciętna cena', value: zlM2(detail.pricePerM2.median) });
    rows.push({ label: 'Typowy zakres', value: range(detail.pricePerM2, zlM2) });
  }

  if (detail.totalPrice) {
    rows.push({ label: 'Typowa cena działki', value: range(detail.totalPrice, pln) });
  }

  if (detail.areaM2) {
    rows.push({ label: 'Zakres powierzchni', value: range(detail.areaM2, m2) });
    rows.push({ label: 'Typowa powierzchnia', value: m2(detail.areaM2.median) });
  }

  if (detail.uzbrojoneShare !== null) {
    rows.push({ label: 'Prąd i woda na działce', value: pct(detail.uzbrojoneShare) });
  }

  if (detail.planShare !== null) {
    rows.push({ label: 'Z planem (MPZP) lub WZ', value: pct(detail.planShare) });
  }

  return rows;
}

// ── Opis lokalny (kilka akapitów zbudowanych z danych) ─────────────────────────
export function buildLocalParagraphs(
  city: SeoCity,
  type: SeoType,
  _region: SeoRegion | undefined,
  detail: CategoryDetail
): string[] {
  const seed = `${city.slug}/${type.slug}`;
  const gpl = adjGen(type);
  const out: string[] = [];

  // Akapit 1: ile ofert i od kogo (strona renderuje się tylko gdy count > 0).
  const n = formatIntPL(detail.count);
  const openers = [
    `W okolicy ${city.gen} mamy obecnie ${n} ${ofertaWord(detail.count)} działek ${gpl}.`,
    `Na sprzedaż ${inCity(city)} i w okolicy jest teraz ${n} ${ofertaWord(detail.count)} działek ${gpl}.`,
    `Aktualnie w okolicy ${city.gen} zebraliśmy ${n} ${ofertaWord(detail.count)} działek ${gpl}.`,
  ];
  let p1 = openers[pickVariant(seed, openers.length)];
  if (detail.officeCount === 0) {
    p1 += ` Wszystkie pochodzą od właścicieli prywatnych.`;
  } else if (detail.privateCount === 0) {
    p1 += ` Wszystkie wystawiły biura nieruchomości.`;
  } else {
    p1 += ` ${formatIntPL(detail.privateCount)} z nich wystawili właściciele prywatni, a ${formatIntPL(detail.officeCount)} biura nieruchomości.`;
  }
  p1 += ` ${capitalize(type.desc)}`;
  out.push(p1);

  // Akapit 2: ceny i powierzchnie (albo uczciwie: za mało danych).
  if (detail.pricePerM2 && detail.areaM2) {
    const priceVariants = [
      `Przeciętna cena to ${zlM2(detail.pricePerM2.median)}, a typowe stawki w ofertach mieszczą się ${range(detail.pricePerM2, zlM2)}.`,
      `Środek rynku wypada przy ${zlM2(detail.pricePerM2.median)}, a większość ofert ma ${range(detail.pricePerM2, zlM2)}.`,
    ];
    let p2 = priceVariants[pickVariant(seed, priceVariants.length)];
    if (detail.totalPrice) {
      p2 += ` Za całą działkę ceny najczęściej wynoszą ${range(detail.totalPrice, pln)}.`;
    }
    p2 += ` Powierzchnie to zwykle ${range(detail.areaM2, m2)}, najczęściej w okolicy ${m2(detail.areaM2.median)}.`;
    out.push(p2);
  } else if (detail.areaM2) {
    out.push(
      `Powierzchnie dostępnych działek mieszczą się zwykle ${range(detail.areaM2, m2)}, typowo około ${m2(detail.areaM2.median)}. Ofert jest na razie za mało, by podać wiarygodną przeciętną cenę, więc stawki najlepiej sprawdzić wprost w aktualnych ogłoszeniach powyżej.`
    );
  } else {
    out.push(
      `To wciąż wąska oferta, dlatego ceny i powierzchnie najlepiej sprawdzić wprost w aktualnych ogłoszeniach powyżej. Nie podajemy uśrednionych liczb, gdy próbka jest za mała, żeby nie wprowadzać w błąd.`
    );
  }

  // Akapit 3: media i stan formalny (tylko gdy mamy wiarygodny udział).
  if (detail.uzbrojoneShare !== null || detail.planShare !== null) {
    const parts: string[] = [];
    if (detail.uzbrojoneShare !== null) {
      parts.push(
        detail.uzbrojoneShare > 0
          ? `prąd i woda są na działce w ${pct(detail.uzbrojoneShare)} ofert`
          : `żadna z ofert nie ma jeszcze prądu i wody bezpośrednio na działce`
      );
    }
    if (detail.planShare !== null) {
      parts.push(
        detail.planShare > 0
          ? `plan miejscowy (MPZP) lub wydane warunki zabudowy obejmują ${pct(detail.planShare)} działek`
          : `dla żadnej z działek nie wskazano planu miejscowego ani wydanych warunków zabudowy`
      );
    }
    out.push(
      `${capitalize(joinPl(parts))}. Stan mediów i dokumentów potwierdzisz na stronie konkretnej oferty.`
    );
  }

  return out;
}

// ── FAQ (zasila FAQPage JSON-LD + widoczna sekcja) ─────────────────────────────
export function buildFaq(city: SeoCity, type: SeoType, detail: CategoryDetail): FaqItem[] {
  const faq: FaqItem[] = [];
  const adj = type.adj;
  const gpl = adjGen(type);
  const fem = typFem(type);

  // 1. Cena
  if (detail.pricePerM2) {
    let a = `Przeciętna cena działek ${gpl} w okolicy ${city.gen} to ${zlM2(detail.pricePerM2.median)}, a typowe stawki w ofertach to ${range(detail.pricePerM2, zlM2)}.`;
    if (detail.totalPrice) a += ` Za całą działkę ceny najczęściej wynoszą ${range(detail.totalPrice, pln)}.`;
    a += ` Liczby wyliczamy na bieżąco z aktywnych ogłoszeń, nie z cenników.`;
    faq.push({ question: `Ile kosztuje działka ${fem} ${inCity(city)}?`, answer: a });
  } else if (detail.count > 0) {
    faq.push({
      question: `Ile kosztuje działka ${fem} ${inCity(city)}?`,
      answer: `${capitalize(inCity(city))} jest na razie za mało ofert działek ${gpl}, aby podać wiarygodną przeciętną cenę. Aktualne stawki sprawdzisz wprost w ogłoszeniach na tej stronie.`,
    });
  }

  // 2. Powierzchnia
  if (detail.areaM2) {
    faq.push({
      question: `Jakie powierzchnie mają działki ${adj} w okolicy ${city.gen}?`,
      answer: `Dostępne działki ${adj} mają zwykle ${range(detail.areaM2, m2)}, najczęściej w okolicy ${m2(detail.areaM2.median)}. Powierzchnię każdej oferty zawęzisz suwakiem nad listą.`,
    });
  }

  // 3. Uzbrojenie (twardo: na działce)
  if (detail.uzbrojoneShare !== null) {
    faq.push({
      question: `Czy działki ${adj} ${inCity(city)} są uzbrojone?`,
      answer:
        detail.uzbrojoneShare > 0
          ? `Prąd i wodę bezpośrednio na działce ma ${pct(detail.uzbrojoneShare)} ofert w tej okolicy. Liczymy „twardo", czyli tylko przyłącza na samej działce, a nie „w drodze" czy „możliwość podłączenia". Stan mediów każdej działki widać w szczegółach oferty.`
          : `Wśród obecnych ofert żadna nie ma jeszcze prądu i wody bezpośrednio na działce. Część może mieć media w drodze lub możliwość podłączenia, co sprawdzisz w szczegółach konkretnej oferty.`,
    });
  }

  // 4. MPZP / WZ
  if (detail.planShare !== null) {
    faq.push({
      question: `Czy działki ${adj} ${inCity(city)} mają plan miejscowy lub warunki zabudowy?`,
      answer:
        detail.planShare > 0
          ? `Plan miejscowy (MPZP) lub wydane warunki zabudowy obejmują ${pct(detail.planShare)} działek ${gpl} w tej okolicy. To stan deklarowany w ogłoszeniu, który przed zakupem warto potwierdzić w urzędzie gminy.`
          : `Dla obecnych ofert nie wskazano planu miejscowego ani wydanych warunków zabudowy. Przeznaczenie działki potwierdzisz w urzędzie gminy na podstawie MPZP lub wniosku o WZ.`,
    });
  }

  // 5. Ile ofert / od kogo
  if (detail.count > 0) {
    faq.push({
      question: `Ile jest ofert działek ${gpl} w okolicy ${city.gen}?`,
      answer: `Na tej stronie zebraliśmy ${formatIntPL(detail.count)} ${ofertaWord(detail.count)} działek ${gpl} w promieniu kilkudziesięciu kilometrów od ${city.gen}, ${fromWhoText(detail)}. Listę aktualizujemy na bieżąco z ogłoszeń i integracji z biurami.`,
    });
  }

  return faq;
}

// ── drobne helpery językowe ────────────────────────────────────────────────────
function ofertaWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return 'ofertę';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'oferty';
  return 'ofert';
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

// Łączy listę fraz po polsku: „a”, „b oraz c”.
function joinPl(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} oraz ${parts[parts.length - 1]}`;
}
