import { describe, expect, it } from "vitest";
import { ESTRAZIONI_ACTIONS } from "@/pages/EstrazioniStampePage";

describe("Estrazioni e Stampe — card spostate da Gestione Polizze", () => {
  it("include CIG Temporanei e Regolazioni attese con le rotte dedicate", () => {
    const cig = ESTRAZIONI_ACTIONS.find((a) => a.path === "/portafoglio/estrazioni/cig-temporanei");
    const reg = ESTRAZIONI_ACTIONS.find((a) => a.path === "/portafoglio/estrazioni/regolazioni-attese");
    expect(cig?.label).toBe("CIG Temporanei");
    expect(reg?.label).toBe("Regolazioni attese");
  });

  it("include Restituzione originali", () => {
    const card = ESTRAZIONI_ACTIONS.find((a) => a.path === "/portafoglio/estrazioni/restituzione-originali");
    expect(card?.label).toBe("Restituzione originali");
  });

  it("include Documentazione da revisionare", () => {
    const card = ESTRAZIONI_ACTIONS.find((a) => a.path === "/portafoglio/estrazioni/documentazione-revisione");
    expect(card?.label).toBe("Documentazione da revisionare");
  });

  it("non duplica le funzioni E/C già presenti in Contabilità", () => {
    expect(ESTRAZIONI_ACTIONS.some((a) => a.path === "/contabilita/ec-agenzia")).toBe(false);
    expect(ESTRAZIONI_ACTIONS.some((a) => a.path === "/contabilita/ec-agenzia/storico")).toBe(false);
    expect(ESTRAZIONI_ACTIONS.some((a) => a.path === "/contabilita/ec-cliente/storico")).toBe(false);
  });

  it("usa lo stesso layout delle altre card (label + description + path)", () => {
    for (const a of ESTRAZIONI_ACTIONS) {
      expect(a.label.length).toBeGreaterThan(2);
      expect(a.description.length).toBeGreaterThan(8);
      expect(a.path.startsWith("/")).toBe(true);
    }
  });
});
