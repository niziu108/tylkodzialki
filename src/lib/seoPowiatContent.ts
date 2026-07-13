// P22: generowanie treści i FAQ dla strony powiatu z realnych danych (CategoryDetail).
// Ten sam duch co seoCategoryContent (P21): konkret z bazy, zero długich myślników,
// uczciwie przy małej próbce. Formatery zduplikowane celowo, by nie ruszać żywego P21.

import type { CategoryDetail, RangeStat } from '@/lib/seoHub';
import { formatIntPL, formatPLN } from '@/lib/format';
import { powiatGen, powiatLoc, powiatNom } from '@/lib/seoPowiaty';

export type FaqItem = { question: string; answer: string };

const pln = (v: number) => formatPLN(v);
const m2 = (v: number) => `${formatIntPL(v)} m²`;
const zlM2 = (v: number) => `${formatIntPL(v)} zł/m²`;
const pct = (s: number) => `${Math.round(s * 100)}%`;

function range(stat: RangeStat, fmt: (n: number) => string): string {
  if (stat.low === stat.high) return fmt(stat.low);
  return `od ${fmt(stat.low)} do ${fmt(stat.high)}`;
}

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

function joinPl(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} oraz ${parts[parts.length - 1]}`;
}

// ── Opis lokalny powiatu ───────────────────────────────────────────────────────
export function buildPowiatParagraphs(
  adj: string,
  regionName: string,
  detail: CategoryDetail
): string[] {
  const out: string[] = [];
  const n = formatIntPL(detail.count);

  // Akapit 1: skala + od kogo (strona renderuje się tylko gdy count > 0).
  let p1 = `W ${powiatLoc(adj)} (województwo ${regionName}) mamy obecnie ${n} ${ofertaWord(detail.count)} działek na sprzedaż.`;
  if (detail.officeCount === 0) {
    p1 += ` Wszystkie pochodzą od właścicieli prywatnych.`;
  } else if (detail.privateCount === 0) {
    p1 += ` Wszystkie wystawiły biura nieruchomości.`;
  } else {
    p1 += ` ${formatIntPL(detail.privateCount)} z nich wystawili właściciele prywatni, a ${formatIntPL(detail.officeCount)} biura nieruchomości.`;
  }
  p1 += ` To oferty z wielu miejscowości w granicach ${powiatGen(adj)}, zebrane w jednym miejscu.`;
  out.push(p1);

  // Akapit 2: ceny i powierzchnie (albo uczciwie: za mało danych).
  if (detail.pricePerM2 && detail.areaM2) {
    let p2 = `Przeciętna cena to ${zlM2(detail.pricePerM2.median)}, a typowe stawki mieszczą się ${range(detail.pricePerM2, zlM2)}.`;
    if (detail.totalPrice) {
      p2 += ` Za całą działkę ceny najczęściej wynoszą ${range(detail.totalPrice, pln)}.`;
    }
    p2 += ` Powierzchnie to zwykle ${range(detail.areaM2, m2)}, najczęściej w okolicy ${m2(detail.areaM2.median)}.`;
    out.push(p2);
  } else if (detail.areaM2) {
    out.push(
      `Powierzchnie działek mieszczą się zwykle ${range(detail.areaM2, m2)}, typowo około ${m2(detail.areaM2.median)}. Ofert jest na razie za mało, by podać wiarygodną przeciętną cenę, więc stawki najlepiej sprawdzić wprost w aktualnych ogłoszeniach powyżej.`
    );
  } else {
    out.push(
      `To wciąż wąska oferta, dlatego ceny i powierzchnie najlepiej sprawdzić wprost w aktualnych ogłoszeniach powyżej. Nie podajemy uśrednionych liczb, gdy próbka jest za mała, żeby nie wprowadzać w błąd.`
    );
  }

  // Akapit 3: media i stan formalny (tylko gdy wiarygodny udział).
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

// ── FAQ powiatu ────────────────────────────────────────────────────────────────
export function buildPowiatFaq(adj: string, detail: CategoryDetail): FaqItem[] {
  const faq: FaqItem[] = [];

  if (detail.pricePerM2) {
    let a = `Przeciętna cena działek w ${powiatLoc(adj)} to ${zlM2(detail.pricePerM2.median)}, a typowe stawki w ofertach to ${range(detail.pricePerM2, zlM2)}.`;
    if (detail.totalPrice) a += ` Za całą działkę ceny najczęściej wynoszą ${range(detail.totalPrice, pln)}.`;
    a += ` Liczby wyliczamy na bieżąco z aktywnych ogłoszeń w tym powiecie.`;
    faq.push({ question: `Ile kosztuje działka w ${powiatLoc(adj)}?`, answer: a });
  } else if (detail.count > 0) {
    faq.push({
      question: `Ile kosztuje działka w ${powiatLoc(adj)}?`,
      answer: `W ${powiatLoc(adj)} jest na razie za mało ofert, aby podać wiarygodną przeciętną cenę. Aktualne stawki sprawdzisz wprost w ogłoszeniach na tej stronie.`,
    });
  }

  if (detail.areaM2) {
    faq.push({
      question: `Jakie powierzchnie mają działki w ${powiatLoc(adj)}?`,
      answer: `Dostępne działki mają zwykle ${range(detail.areaM2, m2)}, najczęściej w okolicy ${m2(detail.areaM2.median)}. Powierzchnię każdej oferty zawęzisz suwakiem nad listą.`,
    });
  }

  if (detail.uzbrojoneShare !== null) {
    faq.push({
      question: `Czy działki w ${powiatLoc(adj)} są uzbrojone?`,
      answer:
        detail.uzbrojoneShare > 0
          ? `Prąd i wodę bezpośrednio na działce ma ${pct(detail.uzbrojoneShare)} ofert w tym powiecie. Liczymy „twardo", czyli tylko przyłącza na samej działce, a nie „w drodze" czy „możliwość podłączenia". Stan mediów każdej działki widać w szczegółach oferty.`
          : `Wśród obecnych ofert żadna nie ma jeszcze prądu i wody bezpośrednio na działce. Część może mieć media w drodze lub możliwość podłączenia, co sprawdzisz w szczegółach konkretnej oferty.`,
    });
  }

  if (detail.planShare !== null) {
    faq.push({
      question: `Czy działki w ${powiatLoc(adj)} mają plan miejscowy lub warunki zabudowy?`,
      answer:
        detail.planShare > 0
          ? `Plan miejscowy (MPZP) lub wydane warunki zabudowy obejmują ${pct(detail.planShare)} działek w tym powiecie. To stan deklarowany w ogłoszeniu, który przed zakupem warto potwierdzić w urzędzie gminy.`
          : `Dla obecnych ofert nie wskazano planu miejscowego ani wydanych warunków zabudowy. Przeznaczenie działki potwierdzisz w urzędzie gminy na podstawie MPZP lub wniosku o WZ.`,
    });
  }

  if (detail.count > 0) {
    const fromWho =
      detail.officeCount === 0
        ? `wszystkie od właścicieli prywatnych`
        : detail.privateCount === 0
          ? `wszystkie od biur nieruchomości`
          : `${formatIntPL(detail.privateCount)} od osób prywatnych i ${formatIntPL(detail.officeCount)} od biur`;
    faq.push({
      question: `Ile jest ofert działek w ${powiatLoc(adj)}?`,
      answer: `Na tej stronie zebraliśmy ${formatIntPL(detail.count)} ${ofertaWord(detail.count)} działek z ${powiatGen(adj)}, ${fromWho}. Listę aktualizujemy na bieżąco z ogłoszeń i integracji z biurami.`,
    });
  }

  return faq;
}

// Nagłówek strony (mianownik), np. „Działki na sprzedaż, powiat giżycki".
export function powiatHeading(adj: string): string {
  return capitalize(powiatNom(adj));
}
