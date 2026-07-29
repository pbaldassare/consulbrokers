import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildMovimentoDedupKey,
  buildMovimentoContentDedupKey,
  buildPreviewEstratto,
  detectColonneEstratto,
  excelCellValueForColumn,
  fetchExistingMovimentoDedupKeys,
  isMovimentoDedupHit,
  normalizeDescrizioneDedup,
  parseDataBancaria,
  parseImportoBancario,
  resolveImportoEstratto,
  __DEDUP_FETCH_PAGE,
} from "@/lib/movimentiBancari";

const rangeMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            range: (...args: unknown[]) => rangeMock(...args),
          }),
        }),
      }),
    }),
  },
}));

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

  it("content-key scarta doppione anche se la data in archivio è diversa", () => {
    const desc =
      "Bonifico a vs favore *COMUNE DI SESTO CAMPANO 2026.1227.1 RINNOVO POLIZZE AUTOMEZZI Info aggiuntive";
    const rows = [{ VALUTA: "01/07/2026", AVERE: 6000, DESCRIZIONE: desc }];
    const ck = buildMovimentoContentDedupKey({
      conto_bancario_id: "conto-1",
      importo: 6000,
      descrizione: desc,
    });
    expect(ck).toBeTruthy();
    const existing = new Set([ck!]);
    // archivio aveva data parseata male (es. 2026-01-07), file ha 2026-07-01
    expect(
      isMovimentoDedupHit(
        {
          conto_bancario_id: "conto-1",
          data_movimento: "2026-07-01",
          importo: 6000,
          descrizione: desc,
        },
        existing,
      ),
    ).toBe(true);
    const p = buildPreviewEstratto("t.csv", rows, {
      contoBancarioId: "conto-1",
      existingDedupKeys: existing,
    });
    expect(p.daImportare).toBe(0);
    expect(p.scartiByMotivo.duplicato).toBe(1);
  });

  it("normalizza descrizione togliendo CRO/IBAN e spazi multipli", () => {
    const a = normalizeDescrizioneDedup(
      "Bonifico  ROSSI  CRO:ABC123  IT60X0542811101000000123456",
    );
    const b = normalizeDescrizioneDedup("Bonifico ROSSI");
    expect(a).toBe(b);
  });

  it("preferisce seriale Excel per colonne data (non w US m/d/yy)", () => {
    const cell = { t: "n", v: 46232, w: "7/29/26" } as any;
    expect(excelCellValueForColumn(cell, "Data valuta")).toBe("2026-07-29");
    expect(excelCellValueForColumn(cell, "Importo")).toBe("7/29/26");
  });

  describe("fetchExistingMovimentoDedupKeys paginazione", () => {
    beforeEach(() => {
      rangeMock.mockReset();
    });

    it("richiede pagine successive finché page size piena", async () => {
      const page1 = Array.from({ length: __DEDUP_FETCH_PAGE }, (_, i) => ({
        conto_bancario_id: "c1",
        data_movimento: "2026-07-01",
        importo: i + 1,
        descrizione: `Bonifico test movimento numero ${i} con testo lungo abbastanza`,
        ordinante: null,
      }));
      const page2 = [
        {
          conto_bancario_id: "c1",
          data_movimento: "2026-07-02",
          importo: 99,
          descrizione: "Bonifico ultimo della seconda pagina con testo lungo",
          ordinante: null,
        },
      ];
      rangeMock
        .mockResolvedValueOnce({ data: page1, error: null })
        .mockResolvedValueOnce({ data: page2, error: null });

      const keys = await fetchExistingMovimentoDedupKeys("c1", ["2026-07-01"]);
      expect(rangeMock).toHaveBeenCalledTimes(2);
      expect(rangeMock.mock.calls[0]).toEqual([0, __DEDUP_FETCH_PAGE - 1]);
      expect(rangeMock.mock.calls[1]).toEqual([__DEDUP_FETCH_PAGE, __DEDUP_FETCH_PAGE * 2 - 1]);
      expect(keys.size).toBeGreaterThan(__DEDUP_FETCH_PAGE);
      expect(
        isMovimentoDedupHit(
          {
            conto_bancario_id: "c1",
            data_movimento: "2026-07-02",
            importo: 99,
            descrizione: "Bonifico ultimo della seconda pagina con testo lungo",
          },
          keys,
        ),
      ).toBe(true);
    });
  });
});

