import { describe, expect, it, vi, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import {
  buildMovimentoDedupKey,
  buildMovimentoContentDedupKey,
  buildMovimentoConstraintDedupKey,
  buildPreviewEstratto,
  detectColonneEstratto,
  excelCellValueForColumn,
  fetchExistingMovimentoDedupKeys,
  findHeaderRowEstratto,
  isDateHeaderEstratto,
  isMovimentoDedupHit,
  isMovimentiBancariDedupViolation,
  isPreambleEstrattoCell,
  normalizeDescrizioneDedup,
  parseDataBancaria,
  parseImportoBancario,
  pickColonnaDescrizione,
  readEstrattoBancarioRows,
  resolveDescrizioneEstratto,
  resolveImportoEstratto,
  sheetRowsPreferDisplay,
  extractOrdinanteFromDescrizione,
  __DEDUP_FETCH_PAGE,
} from "@/lib/movimentiBancari";
import * as XLSX from "xlsx";
import {
  UNICREDIT_ENTRATE_USCITE_AOA,
  UNICREDIT_PREAMBLE_AOA,
} from "@/lib/__tests__/fixtures/unicreditEstratto";

const rangeMock = vi.fn();
const inRangeMock = vi.fn(async () => ({ data: [], error: null }));
const contoImportoRangeMock = vi.fn(async () => ({ data: [], error: null }));
const contoImportoInMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            range: (...args: unknown[]) => (rangeMock as (...a: unknown[]) => unknown)(...args),
          }),
          in: (...inArgs: unknown[]) => {
            (contoImportoInMock as (...a: unknown[]) => unknown)(...inArgs);
            return {
              order: () => ({
                range: (...args: unknown[]) => (contoImportoRangeMock as (...a: unknown[]) => unknown)(...args),
              }),
            };
          },
        }),
        in: () => ({
          order: () => ({
            range: (...args: unknown[]) => (inRangeMock as (...a: unknown[]) => unknown)(...args),
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

  it("CSV ListaMovimenti: date gg/mm/aaaa e importi IT (non mm/dd US né ×100)", async () => {
    const csv = [
      "DATA;VALUTA;DARE;AVERE;DIVISA;DESCRIZIONE_OPERAZIONE;CAUSALE_ABI",
      "03/08/2026;01/08/2026;;203,49;EUR;INCASSO TRAMITE P.O.S. ACCR. TRANSATO;9",
      "03/08/2026;03/08/2026;;160;EUR;Ordinante: TURETTA VALENTINO Causale: ORDINE CONTO;48",
      "03/08/2026;31/07/2026;;1.141,22;EUR;Ordinante: COMUNE S.STEFANO CAD. Causale: ORDINE CONTO;48",
      "04/08/2026;04/08/2026;;118,8;EUR;ORDINE CONTO BERNARDI CARLO;48",
    ].join("\n");
    // jsdom File non ha arrayBuffer: stub minimo usato da readEstrattoBancarioRows
    const file = {
      name: "ListaMovimenti 04 08.csv",
      arrayBuffer: async () => new TextEncoder().encode(csv).buffer,
    } as File;
    const rows = await readEstrattoBancarioRows(file);
    expect(rows).toHaveLength(4);
    const p = buildPreviewEstratto(file.name, rows, { contoBancarioId: "conto-san-dona" });
    expect(p.daImportare).toBe(4);
    expect(p.preview[0]).toMatchObject({
      data_movimento: "2026-08-01",
      importo: 203.49,
    });
    expect(p.preview[1]).toMatchObject({
      data_movimento: "2026-08-03",
      importo: 160,
      ordinante: "TURETTA VALENTINO",
      descrizione: "Ordinante: TURETTA VALENTINO Causale: ORDINE CONTO",
    });
    expect(p.preview[2]).toMatchObject({
      data_movimento: "2026-07-31",
      importo: 1141.22,
    });
    expect(p.preview[3]).toMatchObject({
      data_movimento: "2026-08-04",
      importo: 118.8,
    });
    // Regressione: senza raw:true SheetJS avrebbe prodotto 2026-03-08 / 2026-01-08
    expect(p.preview.some((r) => r.data_movimento?.startsWith("2026-03-"))).toBe(false);
    expect(p.preview.some((r) => r.data_movimento?.startsWith("2026-01-"))).toBe(false);
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

  it("mappa sinonimi descrizione degli estratti IT/EN", () => {
    expect(pickColonnaDescrizione(["Data", "Importo", "Dettaglio"])).toBe("Dettaglio");
    expect(pickColonnaDescrizione(["Data", "Avere", "Note"])).toBe("Note");
    expect(pickColonnaDescrizione(["Date", "Amount", "Narrativa"])).toBe("Narrativa");
    expect(pickColonnaDescrizione(["Date", "Amount", "Description"])).toBe("Description");
    expect(pickColonnaDescrizione(["Data", "Importo", "Desc. operazione"])).toBe("Desc. operazione");
    expect(pickColonnaDescrizione(["Data", "Importo", "Causale"])).toBe("Causale");
    expect(pickColonnaDescrizione(["DATA", "AVERE", "CAUSALE_ABI", "OPERAZIONE"])).toBe("OPERAZIONE");
    expect(pickColonnaDescrizione(["DATA", "AVERE", "CAUSALE_ABI"])).toBeNull();
    // Preferisce narrativa lunga a «Operazione» (tipo movimento)
    expect(pickColonnaDescrizione(["Operazione", "Dettagli", "Importo"])).toBe("Dettagli");
    expect(pickColonnaDescrizione(["Causale ABI", "Note movimento", "Data"])).toBe("Note movimento");
  });

  it("estrae descrizione da colonna Note se Descrizione è vuota", () => {
    const cols = detectColonneEstratto(["DATA", "AVERE", "DESCRIZIONE", "NOTE"]);
    expect(cols.descrizione).toBe("DESCRIZIONE");
    expect(
      resolveDescrizioneEstratto(
        { DATA: "01/10/2026", AVERE: 100, DESCRIZIONE: "", NOTE: "Rinnovo polizza RCA CIG ABC" },
        cols,
      ),
    ).toBe("Rinnovo polizza RCA CIG ABC");
    expect(resolveDescrizioneEstratto({ DATA: "01/10/2026", AVERE: 100 }, cols)).toBe("");
  });

  it("anteprima include descrizione da header Dettaglio / Note / Description", () => {
    const pDettaglio = buildPreviewEstratto("dettaglio.xlsx", [
      { Data: "01/10/2026", Importo: 250, Dettaglio: "Bonifico polizza 123 — Comune di Varese" },
    ]);
    expect(pDettaglio.colonne.descrizione).toBe("Dettaglio");
    expect(pDettaglio.preview[0]?.descrizione).toBe("Bonifico polizza 123 — Comune di Varese");

    const pNote = buildPreviewEstratto("note.xlsx", [
      { Data: "01/10/2026", Avere: 80, Note: "Saldo avviso quietanza 2/4" },
    ]);
    expect(pNote.colonne.descrizione).toBe("Note");
    expect(pNote.preview[0]?.descrizione).toBe("Saldo avviso quietanza 2/4");

    const pEn = buildPreviewEstratto("en.xlsx", [
      { Date: "2026-10-01", Amount: 99, Description: "Insurance premium renewal" },
    ]);
    expect(pEn.colonne.descrizione).toBe("Description");
    expect(pEn.preview[0]?.descrizione).toBe("Insurance premium renewal");
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

  describe("fetchExistingMovimentoDedupKeys filtrato per importi", () => {
    beforeEach(() => {
      rangeMock.mockReset();
      inRangeMock.mockReset();
      inRangeMock.mockResolvedValue({ data: [], error: null });
      contoImportoRangeMock.mockReset();
      contoImportoInMock.mockReset();
    });

    it("scarica dal conto solo gli importi del file, non tutto lo storico", async () => {
      contoImportoRangeMock.mockResolvedValue({
        data: [
          {
            conto_bancario_id: "c1",
            data_movimento: "2026-10-01",
            importo: 230,
            descrizione: "Bonifico a Vostro favore disposto da MITT. STIGLIANI",
            ordinante: "STIGLIANI",
          },
        ],
        error: null,
      });
      const keys = await fetchExistingMovimentoDedupKeys("c1", ["2026-10-01"], [230, 230.001, 0, -330]);
      expect(rangeMock).not.toHaveBeenCalled();
      expect(contoImportoInMock).toHaveBeenCalledWith("importo", [230, -330]);
      expect(
        isMovimentoDedupHit(
          {
            conto_bancario_id: "c1",
            data_movimento: "2026-10-01",
            importo: 230,
            descrizione: "Bonifico a Vostro favore disposto da MITT. STIGLIANI",
            ordinante: "STIGLIANI",
          },
          keys,
        ),
      ).toBe(true);
    });
  });

  describe("fetchExistingMovimentoDedupKeys paginazione", () => {
    beforeEach(() => {
      rangeMock.mockReset();
      inRangeMock.mockReset();
      inRangeMock.mockResolvedValue({ data: [], error: null });
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

    it("include vincolo globale da altri conti sulle stesse date", async () => {
      rangeMock.mockResolvedValueOnce({ data: [], error: null });
      inRangeMock.mockResolvedValueOnce({
        data: [
          {
            conto_bancario_id: "altro-conto",
            data_movimento: "2026-08-03",
            importo: 160,
            descrizione: "Ordinante: TURETTA VALENTINO Causale: ORDINE CONTO",
            ordinante: "TURETTA VALENTINO",
          },
        ],
        error: null,
      });
      const keys = await fetchExistingMovimentoDedupKeys("conto-san-dona", ["2026-08-03"]);
      expect(
        isMovimentoDedupHit(
          {
            conto_bancario_id: "conto-san-dona",
            data_movimento: "2026-08-03",
            importo: 160,
            descrizione: "Ordinante: TURETTA VALENTINO Causale: ORDINE CONTO",
            ordinante: "TURETTA VALENTINO",
          },
          keys,
        ),
      ).toBe(true);
    });
  });

  it("constraint-key allineata al vincolo DB (ignora conto)", () => {
    const a = buildMovimentoConstraintDedupKey({
      data_movimento: "2026-08-03",
      importo: 160,
      descrizione: "Ordinante: TURETTA Causale: X",
      ordinante: "TURETTA",
    });
    const b = buildMovimentoConstraintDedupKey({
      data_movimento: "2026-08-03",
      importo: 160,
      descrizione: "Ordinante: TURETTA Causale: X",
      ordinante: "TURETTA",
    });
    expect(a).toBe(b);
    expect(isMovimentiBancariDedupViolation({ code: "23505", message: "uq_movimenti_bancari_dedup" })).toBe(
      true,
    );
    expect(isMovimentiBancariDedupViolation({ message: "other" })).toBe(false);
  });

  it("anteprima scarta doppione già presente su altro conto (vincolo globale)", () => {
    const rows = [
      {
        VALUTA: "03/08/2026",
        AVERE: 160,
        DESCRIZIONE: "Ordinante: TURETTA VALENTINO Causale: ORDINE CONTO",
        ORDINANTE: "TURETTA VALENTINO",
      },
    ];
    const existing = new Set([
      buildMovimentoConstraintDedupKey({
        data_movimento: "2026-08-03",
        importo: 160,
        descrizione: "Ordinante: TURETTA VALENTINO Causale: ORDINE CONTO",
        ordinante: "TURETTA VALENTINO",
      }),
    ]);
    const p = buildPreviewEstratto("ListaMovimenti 04 08.csv", rows, {
      contoBancarioId: "conto-san-dona",
      existingDedupKeys: existing,
    });
    expect(p.daImportare).toBe(0);
    expect(p.scartiByMotivo.duplicato).toBe(1);
  });
});


describe("estratto Intesa «Lista operazioni» con preambolo", () => {
  it("trova l'intestazione dopo il preambolo e ignora Valuta=EUR come data", () => {
    const aoa: unknown[][] = [
      ["Lista Operazioni"],
      ["Conto", "1000/00016467"],
      [],
      ["Data", "Operazione", "Dettagli", "Conto o carta", "Contabilizzazione", "Categoria ", "Valuta", "Importo"],
      [
        46296,
        "Bonifico disposto da CIALLELLA STEFANO",
        "COD.DISP. 0126 Saldo polizza rca Bonifico a Vostro favore disposto da MITT. CIALLELLA STEFANO BENEF. CONSULBROKERS DIGITAL",
        "Conto 1000/00016467",
        "SI",
        "Bonifici ricevuti",
        "EUR",
        330,
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const rows = sheetRowsPreferDisplay(ws);
    expect(rows).toHaveLength(1);
    const p = buildPreviewEstratto("Lista_Operazioni.xlsx", rows);
    expect(p.colonne.data).toBe("Data");
    expect(p.colonne.descrizione).toBe("Dettagli");
    expect(p.daImportare).toBe(1);
    expect(p.preview[0].data_movimento).toBe("2026-10-01");
    expect(p.preview[0].importo).toBe(330);
    expect(p.preview[0].ordinante).toBe("CIALLELLA STEFANO");
    expect(p.preview[0].descrizione).toMatch(/CIALLELLA STEFANO/);
  });

  it("estrae il mittente da «MITT. … BENEF.»", () => {
    expect(
      extractOrdinanteFromDescrizione(
        "Bonifico a Vostro favore disposto da MITT. STIGLIANI DAMIANOMASIELLO BIANCA BENEF. CONSULBROKERS DIGITAL SRL",
      ),
    ).toBe("STIGLIANI DAMIANOMASIELLO BIANCA");
  });
});

describe("estratto UniCredit con preambolo Rapporto/IBAN", () => {
  const UNICREDIT_UPLOAD =
    "/root/.cursor/projects/home-ubuntu-cursor-projects-cbnet/uploads/MOVIMENTI_UNICREDIT_AL_08_10_e06c.xls";

  it("non tratta «Data da: Rapporto IT…» come header Data", () => {
    expect(isPreambleEstrattoCell("Data da: Rapporto IT 60 B 02008 36282 000101869818")).toBe(true);
    expect(isPreambleEstrattoCell("Rapporto IT 60 B 02008 36282 000101869818 - CONSULBROKERS S.P.A.")).toBe(
      true,
    );
    expect(isDateHeaderEstratto("Data da: Rapporto IT 60 B 02008 36282 000101869818")).toBe(false);
    expect(isDateHeaderEstratto("Data")).toBe(true);
    expect(isDateHeaderEstratto("Data Operaz.")).toBe(true);
    const header = findHeaderRowEstratto(0, 4, (r) => {
      const rows = [
        ["Data da: Rapporto IT 60 B 02008 36282 000101869818 - CONSULBROKERS S.P.A."],
        [],
        ["Data", "", "Descrizione", "EUR", "Caus."],
        ["Operaz.", "Valuta"],
      ];
      return (rows[r] || []).map(String);
    });
    expect(header).toBe(2);
  });

  it("trova Data+EUR dopo il preambolo, unisce Operaz./Valuta e importa gli accrediti", () => {
    const ws = XLSX.utils.aoa_to_sheet(UNICREDIT_PREAMBLE_AOA);
    const rows = sheetRowsPreferDisplay(ws);
    expect(rows).toHaveLength(4);
    expect(Object.keys(rows[0] || {}).some((k) => /rapporto/i.test(k))).toBe(false);
    const p = buildPreviewEstratto("MOVIMENTI_UNICREDIT_AL_08_10.xls", rows);
    expect(p.colonne.data).toMatch(/data|valuta/i);
    expect(p.colonne.importo).toBe("EUR");
    expect(p.colonne.descrizione).toBe("Descrizione");
    expect(p.daImportare).toBe(4);
    expect(p.scarti).toBe(0);
    expect(p.preview[0]).toMatchObject({
      data_movimento: "2026-10-01",
      importo: 594.78,
      ordinante: "SIMIONI MAURA",
      esito: "ok",
    });
    expect(p.preview[1]).toMatchObject({
      data_movimento: "2026-10-01",
      importo: 284.9,
      ordinante: "DARMAN IVANO E DEL ZENERO MICHELA",
    });
    expect(p.preview[2]).toMatchObject({
      data_movimento: "2026-10-05",
      importo: 1343.01,
      ordinante: "COMUNE DI SAN GIORGIO IN BOSCO",
    });
    expect(p.preview[3]).toMatchObject({
      data_movimento: "2026-10-06",
      importo: 690.09,
      ordinante: "Snezha Dinova",
    });
    expect(p.preview[0]?.descrizione).toMatch(/BONIFICO SEPA DA/);
  });

  it("legge il xlsx costruito via readEstrattoBancarioRows", async () => {
    const ws = XLSX.utils.aoa_to_sheet(UNICREDIT_PREAMBLE_AOA);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimenti");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = {
      name: "MOVIMENTIUNICREDITAL0810.xlsx",
      arrayBuffer: async () => buf,
    } as File;
    const rows = await readEstrattoBancarioRows(file);
    const p = buildPreviewEstratto(file.name, rows);
    expect(p.righeFile).toBe(4);
    expect(p.daImportare).toBe(4);
    expect(p.scartiByMotivo.importo_zero_o_invalido ?? 0).toBe(0);
  });

  it("mappa Entrate/Uscite e scarta solo le uscite", () => {
    const ws = XLSX.utils.aoa_to_sheet(UNICREDIT_ENTRATE_USCITE_AOA);
    const rows = sheetRowsPreferDisplay(ws);
    const p = buildPreviewEstratto("unicredit-entrate.xls", rows);
    expect(p.colonne.avere).toBe("Entrate");
    expect(p.colonne.dare).toBe("Uscite");
    expect(p.daImportare).toBe(1);
    expect(p.scartiByMotivo.solo_dare).toBe(1);
    expect(p.preview.find((r) => r.esito === "ok")).toMatchObject({
      importo: 1234.56,
      ordinante: "ROSSI MARIO",
      data_movimento: "2026-10-01",
    });
  });

  it.skipIf(!existsSync(UNICREDIT_UPLOAD))("importa i 7 accrediti dal file UniCredit caricato", async () => {
    const buf = readFileSync(UNICREDIT_UPLOAD);
    const bytes = new Uint8Array(buf.byteLength);
    bytes.set(buf);
    const file = {
      name: "MOVIMENTI_UNICREDIT_AL_08_10.xls",
      arrayBuffer: async () => bytes.buffer,
    } as File;
    const rows = await readEstrattoBancarioRows(file);
    const p = buildPreviewEstratto(file.name, rows);
    expect(p.righeFile).toBe(7);
    expect(p.daImportare).toBe(7);
    expect(p.scarti).toBe(0);
    expect(p.colonne.importo).toBe("EUR");
    expect(p.colonne.descrizione).toBe("Descrizione");
    expect(p.preview.map((r) => r.importo)).toEqual([594.78, 284.9, 1343.01, 690.09, 1520.28, 383.88, 501.5]);
    expect(p.preview.map((r) => r.data_movimento)).toEqual([
      "2026-10-01",
      "2026-10-01",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-08",
    ]);
    expect(p.preview[0]?.ordinante).toBe("SIMIONI MAURA");
    expect(p.preview[6]?.ordinante).toBe("TREVITRANS SNC ROSSITTO CLAUDI");
  });
});
