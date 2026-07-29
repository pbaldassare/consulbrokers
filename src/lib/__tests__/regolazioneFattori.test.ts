import { describe, expect, it } from "vitest";
import {
  buildRegolazioneFattoriRows,
  regolazioneFattoreKey,
  rowsToInsertPayload,
  yearFromIsoDate,
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
  });
  it("null senza data né fallback", () => {
    expect(yearFromIsoDate("")).toBeNull();
  });
});

describe("buildRegolazioneFattoriRows", () => {
  it("date × fattori → griglia", () => {
    const rows = buildRegolazioneFattoriRows({
      datePresunte: ["2027-03-15", "2028-03-15"],
      fattori,
    });
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => `${r.anno}:${r.fattore_codice}`)).toEqual([
      "2027:fatturato",
      "2027:retribuzioni",
      "2028:fatturato",
      "2028:retribuzioni",
    ]);
    expect(rows[0].data_presunta).toBe("2027-03-15");
  });

  it("senza date → un anno fallback", () => {
    const rows = buildRegolazioneFattoriRows({
      datePresunte: [],
      fattori: [fattori[0]],
      fallbackAnno: 2027,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].anno).toBe(2027);
    expect(rows[0].data_presunta).toBeNull();
  });

  it("merge importi da map e existing", () => {
    const key = regolazioneFattoreKey("f1", 2027);
    const rows = buildRegolazioneFattoriRows({
      datePresunte: ["2027-03-15"],
      fattori: [fattori[0]],
      existing: [{ fattore_id: "f1", anno: 2027, importo_esposto: 100 }],
      importiMap: { [key]: 250 },
    });
    expect(rows[0].importo_esposto).toBe(250);
  });

  it("senza fattori → vuoto", () => {
    expect(
      buildRegolazioneFattoriRows({
        datePresunte: ["2027-03-15"],
        fattori: [],
      }),
    ).toEqual([]);
  });
});

describe("rowsToInsertPayload", () => {
  it("mappa campi DB", () => {
    const rows = buildRegolazioneFattoriRows({
      datePresunte: ["2027-03-15"],
      fattori: [fattori[0]],
      importiMap: { [regolazioneFattoreKey("f1", 2027)]: 12.5 },
    });
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
  });
});
