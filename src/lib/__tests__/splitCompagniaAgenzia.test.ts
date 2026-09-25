import { describe, expect, it } from "vitest";
import { validateIban } from "@/lib/validateIban";
import {
  generateItalianIban,
  isEmptyAgencyRemainder,
  matchBrandPrefix,
  splitCompagniaAgenzia,
} from "@/lib/splitCompagniaAgenzia";

describe("splitCompagniaAgenzia", () => {
  it("Allianz RAS Maniago: compagnia Allianz, agenzia Maniago Spilimbergo", () => {
    const hit = splitCompagniaAgenzia("ALLIANZ RAS MANIAGO SPILIMBERGO");
    expect(hit.esito).toBe("agenzia_da_brand");
    expect(hit.gruppo).toBe("ALLIANZ");
    expect(hit.agenzia).toBe("MANIAGO SPILIMBERGO");
  });

  it("Allianz SPA + sede", () => {
    expect(splitCompagniaAgenzia("ALLIANZ SPA AG. DI TRIESTE").agenzia).toBe("AG. DI TRIESTE");
    expect(splitCompagniaAgenzia("ALLIANZ SPA PORDENONE CENTRO").agenzia).toBe("PORDENONE CENTRO");
    expect(splitCompagniaAgenzia("ALLIANZ SPA MOGLIANO VENETO - IDEA").agenzia).toBe("MOGLIANO VENETO - IDEA");
  });

  it("Allianz senza sede resta compagnia", () => {
    const hit = splitCompagniaAgenzia("ALLIANZ SPA");
    expect(hit.esito).toBe("solo_compagnia");
    expect(hit.gruppo).toBe("ALLIANZ");
    expect(hit.agenzia).toBeNull();
  });

  it("direzione non diventa agenzia", () => {
    const hit = splitCompagniaAgenzia("allianz direzione", "direzione");
    expect(hit.esito).toBe("direzione");
    expect(hit.gruppo).toBe("ALLIANZ");
    expect(hit.agenzia).toBeNull();
  });

  it("agenzia già in testa (MEDIASTUDIO - ALLIANZ)", () => {
    const hit = splitCompagniaAgenzia("MEDIASTUDIO SNC - ALLIANZ SPA SAN DONA' DI PIAVE");
    expect(hit.esito).toBe("gia_agenzia");
    expect(hit.gruppo).toBe("ALLIANZ");
    expect(hit.agenzia).toBe("MEDIASTUDIO SNC");
  });

  it("Generali + agenzia Treviso", () => {
    const hit = splitCompagniaAgenzia("GENERALI ITALIA SPA - AG. TREVISO");
    expect(hit.esito).toBe("agenzia_da_brand");
    expect(hit.gruppo).toBe("GENERALI ITALIA");
    expect(hit.agenzia).toMatch(/TREVISO/i);
  });

  it("AIG Europe S.A. è la compagnia, non l'agenzia S.A.", () => {
    const hit = splitCompagniaAgenzia("AIG EUROPE S.A.");
    expect(hit.esito).toBe("solo_compagnia");
    expect(hit.gruppo).toBe("AIG");
    expect(hit.agenzia).toBeNull();
  });

  it("Dual Italia - Great Lakes: Dual è l'agenzia, Great Lakes la compagnia", () => {
    const hit = splitCompagniaAgenzia("DUAL ITALIA SPA - GREAT LAKES");
    expect(hit.esito).toBe("gia_agenzia");
    expect(hit.agenzia).toBe("DUAL ITALIA SPA");
    expect(hit.gruppo).toBe("Great Lakes Insurance Re");
  });

  it("Aviva + controparte dopo il trattino", () => {
    const hit = splitCompagniaAgenzia("AVIVA ASS.NI - A.B.F. SAS");
    expect(hit.esito).toBe("agenzia_da_brand");
    expect(hit.gruppo).toBe("AVIVA");
    expect(hit.agenzia).toBe("A.B.F. SAS");
  });

  it("brand corto non mangia un nome diverso", () => {
    expect(matchBrandPrefix("DAS SPILIMBERGO")?.gruppo).toBe("DAS");
    expect(splitCompagniaAgenzia("GAMALIFE - COMPANHIA DE SEGUROS DE VIDA SA").esito).toBe("sconosciuta");
  });
});

describe("remainder / iban", () => {
  it("scarta resti solo giuridici", () => {
    expect(isEmptyAgencyRemainder("DIREZIONE")).toBe(true);
    expect(isEmptyAgencyRemainder("ITALIAN BRANCH")).toBe(true);
    expect(isEmptyAgencyRemainder("MANIAGO")).toBe(false);
  });

  it("genera IBAN italiano valido e stabile", () => {
    const a = generateItalianIban("e151d2a6-a232-4a65-aee8-a3bb5cedcd8f");
    const b = generateItalianIban("e151d2a6-a232-4a65-aee8-a3bb5cedcd8f");
    expect(a).toBe(b);
    expect(validateIban(a).valid).toBe(true);
    expect(a.startsWith("IT")).toBe(true);
    expect(a).toHaveLength(27);
    expect(a.endsWith("000000000000")).toBe(false);
  });
});
