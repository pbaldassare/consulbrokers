import { describe, expect, it } from "vitest";
import {
  SEDI_UFFICI,
  fileClienteCodiceCanonico,
  fileClienteCodici,
  fileTipoTitolo,
  isTipoExtra,
  isTipoPipq,
  mapCompagniaCodiceSede,
  matchClienteByNome,
  buildClienteNameIndex,
  yearsBetween,
  percentualeCommercialeDaAnagrafica,
} from "@/lib/sediImportShared";

describe("sediImportShared", () => {
  it("tiene una sola mappa sedi MI/PZ/PR", () => {
    expect(Object.keys(SEDI_UFFICI)).toEqual(["MI", "PZ", "PR"]);
    expect(SEDI_UFFICI.PZ.email).toContain("potenza");
  });

  it("alias compagnia e cliente", () => {
    expect(mapCompagniaCodiceSede("REA100")).toBe("REAPZ0");
    expect(mapCompagniaCodiceSede("VIT000")).toBe("VIT104");
    expect(mapCompagniaCodiceSede("IPAL00")).toBe("IPAL00");
    expect(fileClienteCodiceCanonico("006881")).toBe("000909");
    expect(fileClienteCodiceCanonico("011023")).toBe("002591");
    expect(fileClienteCodiceCanonico("D00264")).toBe("D00264");
    expect(fileClienteCodici("006881")).toEqual({ file: "006881", canonico: "000909" });
  });

  it("classifica TipoTit file", () => {
    expect(fileTipoTitolo("PI")).toBe("PI");
    expect(fileTipoTitolo("pq")).toBe("PQ");
    expect(fileTipoTitolo("DP")).toBe("DP");
    expect(fileTipoTitolo("XX")).toBe("altro");
    expect(isTipoPipq("PI")).toBe(true);
    expect(isTipoPipq("AM")).toBe(false);
    expect(isTipoExtra("AM")).toBe(true);
    expect(isTipoExtra("PI")).toBe(false);
  });

  it("matcha anagrafica per nome invertito", () => {
    const index = buildClienteNameIndex([
      { id: "c1", ragione: "AZIENDA OSPEDALIERA SAN CARLO", nome: null, cognome: null },
    ]);
    expect(matchClienteByNome("SAN CARLO AZIENDA OSPEDALIERA", index)).toBe("c1");
  });

  it("yearsBetween non esplode su date vuote", () => {
    expect(yearsBetween(null, "2026-01-01")).toBe(1);
    expect(yearsBetween("2025-01-01", "2026-01-01")).toBe(1);
  });

  it("prende % commerciale da percentuale_base del produttore", () => {
    const percById = { "interfidi": 40, "altro": 100 };
    expect(percentualeCommercialeDaAnagrafica("interfidi", percById)).toBe(40);
    expect(percentualeCommercialeDaAnagrafica("altro", percById)).toBe(100);
    expect(percentualeCommercialeDaAnagrafica("manca", percById)).toBeNull();
    expect(percentualeCommercialeDaAnagrafica(null, percById)).toBeNull();
  });
});
