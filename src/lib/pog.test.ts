// Parser planu ogólnego gminy (POG). Bez sieci: karmimy prawdziwymi odpowiedziami usługi GUGiK.
// Kluczowa rzecz do obrony testem: brak danych gminy MUSI dawać null, a nie „działka poza
// obszarem uzupełnienia zabudowy" — to dwie zupełnie różne wiadomości dla kupującego
// ([[feedback-filtry-twarde]]).
import { describe, expect, it } from 'vitest';
import { STREFY, parsePogGml } from './pog';

// Skrócona, ale wierna odpowiedź usługi (Poznań, strefa wielofunkcyjna wielorodzinna + OUZ).
const GML_ZE_STREFA_I_OUZ = `<?xml version="1.0" encoding="UTF-8"?>
<msGMLOutput>
<strefaPlanistyczna_layer>
<gml:name>POG - Strefa Planistyczna</gml:name>
<strefaPlanistyczna_feature>
<lokalnyId>1POG-1429SW</lokalnyId>
<oznaczenie>1429SW</oznaczenie>
<symbol>SW</symbol>
<obowiazujeOd>2025/12/18</obowiazujeOd>
<obowiazujeDo></obowiazujeDo>
<maksNadziemnaIntensywnoscZabudowy>7</maksNadziemnaIntensywnoscZabudowy>
<maksUdzialPowierzchniZabudowy>100</maksUdzialPowierzchniZabudowy>
<maksWysokoscZabudowy>26</maksWysokoscZabudowy>
<minUdzialPowierzchniBiologicznieCzynnej>30</minUdzialPowierzchniBiologicznieCzynnej>
<nazwaAlternatywna></nazwaAlternatywna>
</strefaPlanistyczna_feature>
</strefaPlanistyczna_layer>
<obszarUzupelnieniaZabudowy_layer>
<obszarUzupelnieniaZabudowy_feature>
<lokalnyId>1POG-OUZ</lokalnyId>
</obszarUzupelnieniaZabudowy_feature>
</obszarUzupelnieniaZabudowy_layer>
</msGMLOutput>`;

// Strefa bez parametrów i bez OUZ (Tychy, strefa komunikacyjna).
const GML_BEZ_OUZ = `<?xml version="1.0" encoding="UTF-8"?>
<msGMLOutput>
<strefaPlanistyczna_layer>
<strefaPlanistyczna_feature>
<oznaczenie>1SK</oznaczenie>
<symbol>SK</symbol>
<obowiazujeOd>2025/03/17</obowiazujeOd>
<maksNadziemnaIntensywnoscZabudowy></maksNadziemnaIntensywnoscZabudowy>
<maksWysokoscZabudowy></maksWysokoscZabudowy>
</strefaPlanistyczna_feature>
</strefaPlanistyczna_layer>
</msGMLOutput>`;

const GML_PUSTY = `<?xml version="1.0" encoding="UTF-8"?>\n<msGMLOutput>\n</msGMLOutput>`;

describe('parsePogGml', () => {
  it('czyta strefę z parametrami zabudowy i rozwija symbol na nazwę', () => {
    const pog = parsePogGml(GML_ZE_STREFA_I_OUZ);
    expect(pog?.strefa.symbol).toBe('SW');
    expect(pog?.strefa.nazwa).toContain('wielorodzinną');
    expect(pog?.strefa.oznaczenie).toBe('1429SW');
    expect(pog?.strefa.mieszkaniowa).toBe(true);
    expect(pog?.strefa.maksWysokoscZabudowy).toBe('26');
    expect(pog?.strefa.minUdzialPowierzchniBiologicznieCzynnej).toBe('30');
    expect(pog?.strefa.obowiazujeOd).toBe('2025-12-18');
  });

  it('wykrywa obszar uzupełnienia zabudowy', () => {
    expect(parsePogGml(GML_ZE_STREFA_I_OUZ)?.ouz).toBe(true);
  });

  it('strefa bez obszaru uzupełnienia zabudowy to informacja, a nie brak danych', () => {
    const pog = parsePogGml(GML_BEZ_OUZ);
    expect(pog).not.toBeNull();
    expect(pog?.ouz).toBe(false);
    expect(pog?.strefa.symbol).toBe('SK');
    expect(pog?.strefa.mieszkaniowa).toBe(false);
  });

  it('puste pola nie udają wartości', () => {
    const pog = parsePogGml(GML_BEZ_OUZ);
    expect(pog?.strefa.maksWysokoscZabudowy).toBeNull();
    expect(pog?.strefa.maksNadziemnaIntensywnoscZabudowy).toBeNull();
  });

  it('brak danych gminy daje null, a nie „poza obszarem"', () => {
    expect(parsePogGml(GML_PUSTY)).toBeNull();
    expect(parsePogGml('GetFeatureInfo results:\n\n  Search returned no results.')).toBeNull();
  });
});

describe('słownik stref', () => {
  it('zna wszystkie 13 stref z rozporządzenia', () => {
    expect(Object.keys(STREFY)).toHaveLength(13);
    for (const s of ['SW', 'SJ', 'SZ', 'SU', 'SH', 'SP', 'SR', 'SI', 'SN', 'SC', 'SG', 'SO', 'SK']) {
      expect(STREFY[s]).toBeTruthy();
    }
  });
});
