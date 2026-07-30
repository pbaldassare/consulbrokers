import { describe, expect, it } from "vitest";
import {
  addRegolazioneFattoreRiga,
  buildRegolazioneFattoriRows,
  createRegolazioneFattoreRiga,
  fattoriDisponibiliPerAnno,
  regolazioneFattoreKey,
  removeRegolazioneFattoreRiga,
  rowsToInsertPayload,
  updateRegolazioneFattoreImporto,
  yearFromIsoDate,
  yearSlotsFromDatePresunte,
} from "@/lib/regolazioneFattori";

const fattori = [
  { id: "f1", codice: "fatturato", descrizione: "Fatturato" },
  { id: "f2", codice: "retribuzioni", descrizione: "Retribuzioni" },
];

describe("yearFromIsoDate", () => {
  it("estrae anno da ISO", () => {
    expect(yearFromIsoDate("2027-03-15")).toBe(2027);
  });
  it("fallback se data assente", () => {
    expect(yearFromIsoDate(null, 2028)).toBe(2028);
    expect(yearFromIsoDate("", 2028)).toBe(2028);
  });
  it("null senza data né fallback", () => {
    expect(yearFromIsoDate("")).toBeNull();
  });
});

describe("yearSlotsFromDatePresunte", () => {
  it("mappa date → slot anno", () => {
    expect(yearSlotsFromDatePresunte(["2027-03-15", "2028-03-15"])).toEqual([
      { anno: 2027, data_presunta: "2027-03-15" },
      { anno: 2028, data_presunta: "2028-03-15" },
    ]);
  });
  it("senza date → fallback", () => {
    expect(yearSlotsFromDatePresunte([], 2027)).toEqual([
      { anno: 2027, data_presunta: null },
    ]);
  });
});

describe("buildRegolazioneFattoriRows", () => {
  it("senza existing → lista vuota (non esplode catalogo)", () => {
    expect(
      buildRegolazioneFattoriRows({
        existing: [],
        fattori,
      }),
    ).toEqual([]);
  });

  it("costruisce solo da existing + arricchisce catalogo", () => {
    const rows = buildRegolazioneFattoriRows({
      existing: [
        { fattore_id: "f1", anno: 2027, importo_esposto: 100, data_presunta: "2027-03-15" },
        { fattore_id: "f2", anno: 2028, importo_esposto: 50 },
      ],
      fattori,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      key: regolazioneFattoreKey("f1", 2027),
      fattore_id: "f1",
      anno: 2027,
      importo_esposto: 100,
      data_presunta: "2027-03-15",
      fattore_codice: "fatturato",
      fattore_descrizione: "Fatturato",
    });
    expect(rows[1].fattore_codice).toBe("retribuzioni");
  });

  it("dedupe stesso fattore+anno", () => {
    const rows = buildRegolazioneFattoriRows({
      existing: [
        { fattore_id: "f1", anno: 2027, importo_esposto: 10 },
        { fattore_id: "f1", anno: 2027, importo_esposto: 99 },
      ],
      fattori,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].importo_esposto).toBe(10);
  });
});

describe("add / remove / update", () => {
  it("create + add + unique fattore+anno", () => {
    const a = createRegolazioneFattoreRiga({
      fattore: fattori[0],
      anno: 2027,
      data_presunta: "2027-03-15",
      importo_esposto: 12.5,
    });
    let righe = addRegolazioneFattoreRiga([], a);
    expect(righe).toHaveLength(1);
    const dup = createRegolazioneFattoreRiga({
      fattore: fattori[0],
      anno: 2027,
      importo_esposto: 99,
    });
    righe = addRegolazioneFattoreRiga(righe, dup);
    expect(righe).toHaveLength(1);
    expect(righe[0].importo_esposto).toBe(12.5);

    const b = createRegolazioneFattoreRiga({
      fattore: fattori[1],
      anno: 2027,
    });
    righe = addRegolazioneFattoreRiga(righe, b);
    expect(righe).toHaveLength(2);
  });

  it("remove e update importo", () => {
    const a = createRegolazioneFattoreRiga({ fattore: fattori[0], anno: 2027 });
    let righe = [a];
    righe = updateRegolazioneFattoreImporto(righe, a.key, 250);
    expect(righe[0].importo_esposto).toBe(250);
    righe = removeRegolazioneFattoreRiga(righe, a.key);
    expect(righe).toEqual([]);
  });

  it("fattoriDisponibiliPerAnno esclude già usati", () => {
    const righe = [
      createRegolazioneFattoreRiga({ fattore: fattori[0], anno: 2027 }),
    ];
    expect(fattoriDisponibiliPerAnno(fattori, righe, 2027).map((f) => f.id)).toEqual(["f2"]);
    expect(fattoriDisponibiliPerAnno(fattori, righe, 2028).map((f) => f.id)).toEqual([
      "f1",
      "f2",
    ]);
  });
});

describe("rowsToInsertPayload", () => {
  it("mappa campi DB solo per righe presenti", () => {
    const rows = [
      createRegolazioneFattoreRiga({
        fattore: fattori[0],
        anno: 2027,
        data_presunta: "2027-03-15",
        importo_esposto: 12.5,
      }),
    ];
    expect(rowsToInsertPayload("t1", "r1", rows)).toEqual([
      {
        titolo_id: "t1",
        ramo_id: "r1",
        fattore_id: "f1",
        importo_esposto: 12.5,
        anno: 2027,
        data_presunta: "2027-03-15",
      },
    ]);
    expect(rowsToInsertPayload("t1", "r1", [])).toEqual([]);
  });
});
