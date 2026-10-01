import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { formatCigStampa, numeroPolizzaMadre, resolveCigEc } from "@/lib/cigEcAgenzia";
import { righeFromEcAgenziaTitoli, buildTestoRicercaEcAgenzia } from "@/lib/contabilita/ecAgenziaArchivio";

const ente = { tipo_cliente: "ente" };
const privato = { tipo_cliente: "privato" };

describe("resolveCigEc", () => {
  it("non stampa il CIG per soggetti non obbligati", () => {
    expect(resolveCigEc({ titolo: { cig: "ZB63217ACE" }, cliente: privato })).toEqual({
      cig: null,
      obbligatorio: false,
      mancante: false,
    });
  });

  it("ente: usa il CIG del titolo", () => {
    expect(resolveCigEc({ titolo: { cig: " zb63217ace " }, cliente: ente }).cig).toBe("ZB63217ACE");
  });

  it("ente da gruppo finanziario: eredita il CIG dalla polizza madre", () => {
    const r = resolveCigEc({
      titolo: { cig: null },
      madre: { cig: "A1B2C3D4E5" },
      cliente: { tipo_cliente: null, gruppi_finanziari: { tipo_soggetto: "Ente" } },
    });
    expect(r).toEqual({ cig: "A1B2C3D4E5", obbligatorio: true, mancante: false });
  });

  it("ente: ripiega sul CIG dell'anagrafica cliente", () => {
    const r = resolveCigEc({ titolo: { cig: "" }, madre: null, cliente: { ...ente, codice_cig: "9988776655" } });
    expect(r.cig).toBe("9988776655");
  });

  it("ente: CIG temporaneo o malformato non viene stampato e risulta mancante", () => {
    expect(resolveCigEc({ titolo: { cig: "CIG0012" }, cliente: ente })).toMatchObject({ cig: null, mancante: true });
    expect(resolveCigEc({ titolo: { cig: "ZB63217ACE", temporaneo: true }, cliente: ente }).mancante).toBe(true);
    expect(resolveCigEc({ titolo: { cig: "123" }, cliente: ente }).mancante).toBe(true);
  });

  it("ente senza CIG: mancante", () => {
    expect(resolveCigEc({ titolo: { cig: null }, cliente: ente })).toEqual({
      cig: null,
      obbligatorio: true,
      mancante: true,
    });
  });
});

describe("numeroPolizzaMadre", () => {
  it("regolazione/appendice → numero base", () => {
    expect(numeroPolizzaMadre({ numero_titolo: "M16253671/RG1", sostituisce_polizza: null })).toBe("M16253671");
  });
  it("quietanza → sostituisce_polizza", () => {
    expect(numeroPolizzaMadre({ numero_titolo: "M16253671", sostituisce_polizza: "M16253671" })).toBe("M16253671");
  });
});

describe("stampa e archivio E/C agenzia", () => {
  it("formatta il CIG per la stampa", () => {
    expect(formatCigStampa("ZB63217ACE")).toBe("CIG ZB63217ACE");
    expect(formatCigStampa(null)).toBe("");
  });

  it("archivia il CIG ed è ricercabile nello storico", () => {
    const righe = righeFromEcAgenziaTitoli([
      { polizza: "M1 - 1", cig: "ZB63217ACE", cliente: "COMUNE X", ramo: "", periodo: "", tp: "AM", premio: 1, provvigioni: 0, mi: "B" },
    ]);
    expect(righe[0].cig).toBe("ZB63217ACE");
    expect(buildTestoRicercaEcAgenzia("R1", righe)).toContain("zb63217ace");
  });
});
