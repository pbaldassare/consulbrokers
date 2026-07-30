import { describe, expect, it } from "vitest";
import {
  formatClienteEc,
  resolveCompagniaCollegataNome,
  resolveImportoVersatoAgenzia,
  resolveMiCodiceEcAgenzia,
  resolveTipoPagamentoLabelEcAgenzia,
  resolveTipoPagamentoMiEcAgenzia,
} from "@/lib/ecAgenziaDisplay";

describe("ecAgenziaDisplay", () => {
  it("formatClienteEc preferisce ragione sociale", () => {
    expect(formatClienteEc({ ragione_sociale: "SRL Test", nome: "Mario", cognome: "Rossi" })).toBe("SRL Test");
    expect(formatClienteEc({ nome: "Mario", cognome: "Rossi" })).toBe("Rossi Mario");
  });

  it("resolveImportoVersatoAgenzia usa premio lordo se incassato", () => {
    expect(
      resolveImportoVersatoAgenzia({ stato: "incassato", premio_lordo: 349, importo_incassato: 348.5 }),
    ).toBe(349);
    expect(
      resolveImportoVersatoAgenzia({ stato: "attivo", premio_lordo: 349, importo_incassato: 100 }),
    ).toBe(100);
  });

  it("resolveTipoPagamentoLabelEcAgenzia non espone abbuono né compensazione legacy", () => {
    expect(resolveTipoPagamentoLabelEcAgenzia("abbuono")).toBe("Premio saldato");
    expect(resolveTipoPagamentoLabelEcAgenzia("compensato")).toBe("Premio saldato");
    expect(resolveTipoPagamentoLabelEcAgenzia("misto_compensato")).toBe("Premio saldato");
    expect(resolveTipoPagamentoLabelEcAgenzia("bonifico")).toBe("Bonifico");
    expect(resolveTipoPagamentoLabelEcAgenzia("costi_consulbrokers")).toBe("Bonifico");
    expect(resolveTipoPagamentoLabelEcAgenzia("compensazione")).toBe("Bonifico");
  });

  it("resolveMiCodiceEcAgenzia mappa acconti e pag. diretto a B, garantito a *", () => {
    expect(resolveMiCodiceEcAgenzia("anticipo")).toBe("B");
    expect(resolveMiCodiceEcAgenzia(null)).toBe("B");
    expect(resolveMiCodiceEcAgenzia("pagamento_diretto_compagnia")).toBe("B");
    expect(resolveMiCodiceEcAgenzia("garantito")).toBe("*");
  });

  it("resolveCompagniaCollegataNome legge gruppo compagnia", () => {
    expect(resolveCompagniaCollegataNome({ gruppi_compagnia: { descrizione: "AIG" } })).toBe("AIG");
    expect(resolveCompagniaCollegataNome({ gruppo_compagnia: "ALLIANZ" })).toBe("ALLIANZ");
    expect(resolveCompagniaCollegataNome(null)).toBe("");
  });

  it("resolveTipoPagamentoMiEcAgenzia non espone abbuono", () => {
    expect(resolveTipoPagamentoMiEcAgenzia("bonifico")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("costi_consulbrokers")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("compensazione")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("abbuono")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("compensato")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("contanti")).toBe("C");
    expect(resolveTipoPagamentoMiEcAgenzia("anticipo")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("anticipo_misto")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("assegno")).toBe("A");
    expect(resolveTipoPagamentoMiEcAgenzia("pagamento_diretto_compagnia")).toBe("B");
    expect(resolveTipoPagamentoMiEcAgenzia("garantito")).toBe("*");
  });
});
