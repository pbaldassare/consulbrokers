import { describe, expect, it } from "vitest";
import {
  buildMovimentoDedupKey,
  buildPreviewEstratto,
  detectColonneEstratto,
  parseDataBancaria,
  parseImportoBancario,
  resolveImportoEstratto,
} from "@/lib/movimentiBancari";

describe("estratto bancario CSV/Excel", () => {
  it("parse importo italiano e numerico", () => {
    expect(parseImportoBancario("1.234,56")).toBeCloseTo(1234.56);
    expect(parseImportoBancario(385)).toBe(385);
  });

  it("parse importi BCC con spazi e migliaia IT (non usare v Excel)", () => {
    expect(parseImportoBancario(" 838,09 ")).toBeCloseTo(838.09);
    expect(parseImportoBancario(" 5.323,40 ")).toBeCloseTo(5323.4);
    expect(parseImportoBancario(" 42.000,00 ")).toBeCloseTo(42000);
    expect(parseImportoBancario(" 1.000,00 ")).toBeCloseTo(1000);
    expect(parseImportoBancario(" 226,00 ")).toBeCloseTo(226);
  });

  it("parse data IT e ISO", () => {
    expect(parseDataBancaria("30/06/2026")).toBe("2026-06-30");
    expect(parseDataBancaria("01/07/2026")).toBe("2026-07-01"); // non US 1 gennaio
    expect(parseDataBancaria("07/10/2026")).toBe("2026-10-07");
    expect(parseDataBancaria("2026-06-30")).toBe("2026-06-30");
    // Date a mezzanotte locale IT: non usare UTC (giorno -1)
    expect(parseDataBancaria(new Date(2026, 9, 7, 0, 0, 0))).toBe("2026-10-07");
  });

  it("rileva colonne DARE/AVERE tipiche CSV banca", () => {
    const cols = detectColonneEstratto(["DATA", "VALUTA", "DARE", "AVERE", "DESCRIZIONE_OPERAZIONE"]);
    expect(cols.data).toBe("VALUTA");
    expect(cols.avere).toBe("AVERE");
    expect(cols.dare).toBe("DARE");
    expect(cols.descrizione).toBe("DESCRIZIONE_OPERAZIONE");
    expect(cols.ordinante).toBeNull();
  });

  it("non usa Controparte come ordinante (spesso IBAN)", () => {
    const cols = detectColonneEstratto(["DATA", "CONTROPARTE", "AVERE", "DESCRIZIONE"]);
    expect(cols.ordinante).toBeNull();
    expect(cols.descrizione).toBe("DESCRIZIONE");
  });

  it("usa Avere come importo e scarta solo Dare", () => {
    const cols = detectColonneEstratto(["DARE", "AVERE"]);
    expect(resolveImportoEstratto({ DARE: "", AVERE: 385 }, cols)).toEqual({ importo: 385 });
    expect(resolveImportoEstratto({ DARE: 100, AVERE: "" }, cols)).toEqual({
      importo: 0,
      motivo: "solo_dare",
    });
  });

  it("anteprima marca doppioni già in archivio e pulisce IBAN ordinante", () => {
    const rows = [
      {
        VALUTA: "30/06/2026",
        AVERE: 100,
        DESCRIZIONE: "Bonifico a vs favore *ROSSI MARIO RINNOVO",
        ORDINANTE: "IT92P0301503200000002123456",
      },
    ];
    const p0 = buildPreviewEstratto("t.csv", rows, { contoBancarioId: "conto-1" });
    expect(p0.daImportare).toBe(1);
    expect(p0.preview[0]?.ordinante).toBe("ROSSI MARIO");

    const existing = new Set([
      buildMovimentoDedupKey({
        conto_bancario_id: "conto-1",
        data_movimento: "2026-06-30",
        importo: 100,
        descrizione: "Bonifico a vs favore *ROSSI MARIO RINNOVO",
        ordinante: "ROSSI MARIO",
      }),
    ]);
    const p = buildPreviewEstratto("t.csv", rows, {
      contoBancarioId: "conto-1",
      existingDedupKeys: existing,
    });
    expect(p.daImportare).toBe(0);
    expect(p.scartiByMotivo.duplicato).toBe(1);
  });
});

