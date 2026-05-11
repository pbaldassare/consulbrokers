import { describe, it, expect } from "vitest";
import type { NuovoClienteInitialData } from "@/components/clienti/NuovoClienteDialog";
import type { MatchResult } from "@/components/polizze/ImportNuovaPolizzaAIDialog";

/**
 * Replica della logica di mapping "AI → NuovoClienteInitialData" usata in
 * `ImmissionePolizzaPage.handleAIImportApply` quando il cliente non esiste.
 * Verifica che i campi obbligatori (gruppo finanziario, CUP) NON vengano
 * mai preimpostati: devono essere completati dall'utente nel dialog.
 */
function buildPrefill(m: MatchResult): NuovoClienteInitialData {
  const d = m.data;
  const piva = (d.contraente_partita_iva || "").trim();
  const cf = (d.contraente_codice_fiscale || "").trim().toUpperCase();
  const isAzienda = !!piva || (!!cf && cf.length === 11);
  return {
    tipoCliente: isAzienda ? "azienda" : "privato",
    ragioneSociale: isAzienda ? d.contraente_nome : undefined,
    nome: !isAzienda ? d.contraente_nome : undefined,
    codiceFiscale: cf || undefined,
    partitaIva: piva || undefined,
    email: d.contraente_email,
    telefono: d.contraente_telefono,
    indirizzo: d.contraente_indirizzo,
    cap: d.contraente_cap,
    citta: d.contraente_comune,
    provincia: d.contraente_provincia,
    nazione: d.contraente_nazione,
  };
}

describe("AI import → NuovoClienteDialog prefill", () => {
  it("classifica come AZIENDA quando c'è P.IVA", () => {
    const p = buildPrefill({
      isNewCliente: true,
      data: { contraente_nome: "ACME SRL", contraente_partita_iva: "12345678901" },
    });
    expect(p.tipoCliente).toBe("azienda");
    expect(p.ragioneSociale).toBe("ACME SRL");
    expect(p.partitaIva).toBe("12345678901");
    expect(p.nome).toBeUndefined();
  });

  it("classifica come AZIENDA quando il CF è di 11 cifre (numerico)", () => {
    const p = buildPrefill({
      isNewCliente: true,
      data: { contraente_nome: "Beta Spa", contraente_codice_fiscale: "12345678901" },
    });
    expect(p.tipoCliente).toBe("azienda");
    expect(p.ragioneSociale).toBe("Beta Spa");
  });

  it("classifica come PRIVATO con CF di 16 caratteri", () => {
    const p = buildPrefill({
      isNewCliente: true,
      data: { contraente_nome: "Mario Rossi", contraente_codice_fiscale: "rssmra80a01h501u" },
    });
    expect(p.tipoCliente).toBe("privato");
    expect(p.codiceFiscale).toBe("RSSMRA80A01H501U");
    expect(p.nome).toBe("Mario Rossi");
    expect(p.ragioneSociale).toBeUndefined();
  });

  it("non preimposta MAI gruppo finanziario o codice CUP (campi obbligatori da compilare)", () => {
    const p = buildPrefill({
      isNewCliente: true,
      data: { contraente_nome: "Comune di Varese", contraente_partita_iva: "00441340121" },
    });
    // Sanity: questi campi non esistono nel prefill — il dialog DEVE forzarli a mano
    expect((p as any).gruppoFinanziarioId).toBeUndefined();
    expect((p as any).codiceCup).toBeUndefined();
  });
});
