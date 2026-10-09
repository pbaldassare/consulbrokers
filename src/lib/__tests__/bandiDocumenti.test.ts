import { describe, expect, it } from "vitest";
import {
  buildHarvestNote,
  classifyDocumentoHash,
  countNovitaDocumenti,
  documentiVisibili,
  groupDocumentiByTipo,
  inferTipoDocumentoBando,
  labelStatoDocumentoBando,
  labelTipoDocumentoBando,
  buildPortaleRefreshNote,
  formatPortaleDateTime,
  harvestRunAzione,
  lastPortaleAttivita,
} from "@/lib/bandiDocumenti";

describe("bandiDocumenti", () => {
  it("riconosce il tipo dal nome o dall'url", () => {
    expect(inferTipoDocumentoBando("Disciplinare di gara.pdf")).toBe("disciplinare");
    expect(inferTipoDocumentoBando(null, "https://x/esito-aggiudicazione.pdf")).toBe("esito");
    expect(inferTipoDocumentoBando("avviso-ted.pdf")).toBe("bando");
    expect(inferTipoDocumentoBando("note.docx")).toBe("altro");
  });

  it("confronta l'hash senza overwrite cieco", () => {
    expect(classifyDocumentoHash(null, "aaa")).toBe("nuovo");
    expect(classifyDocumentoHash("aaa", "aaa")).toBe("invariato");
    expect(classifyDocumentoHash("aaa", "bbb")).toBe("aggiornato");
  });

  it("conta le novità del fascicolo", () => {
    expect(countNovitaDocumenti([
      { stato: "nuovo" },
      { stato: "aggiornato" },
      { stato: "invariato" },
    ])).toEqual({ nuovi: 1, aggiornati: 1 });
  });

  it("compone la nota harvest", () => {
    expect(buildHarvestNote({ arricchito: true, nuovi: 1, aggiornati: 0 }))
      .toBe("Harvest: scheda aggiornata, 1 doc nuovo");
    expect(buildHarvestNote({})).toBe("Nessuna novità dal portale");
    expect(buildPortaleRefreshNote({ arricchito: true, nuoviUrl: 2 }))
      .toBe("Portale: scheda bando aggiornata; 2 nuovi riferimenti — usa «Scarica dal portale»");
    expect(buildPortaleRefreshNote({})).toBe("Nessun nuovo dato dal portale");
    expect(labelTipoDocumentoBando("capitolato")).toBe("Capitolato");
    expect(labelStatoDocumentoBando("nuovo")).toBe("Nuovo");
  });

  it("raggruppa il fascicolo per tipo", () => {
    const groups = groupDocumentiByTipo([
      { tipo: "esito", nome: "e.pdf" },
      { tipo: "bando", nome: "b.pdf" },
      { tipo: "bando", nome: "b2.pdf" },
      { tipo: "sconosciuto", nome: "x.pdf" },
    ]);
    expect(groups.map((g) => g.tipo)).toEqual(["bando", "esito", "altro"]);
    expect(groups[0].docs).toHaveLength(2);
    expect(groups[0].label).toBe("Bando");
  });

  it("nasconde i documenti rimossi dall'archivio", () => {
    expect(documentiVisibili([
      { stato: "nuovo" },
      { stato: "rimosso" },
      { stato: "invariato" },
    ])).toHaveLength(2);
  });

  it("formatta data/ora portale in italiano o Mai", () => {
    expect(formatPortaleDateTime(null)).toBe("Mai");
    expect(formatPortaleDateTime("non-una-data")).toBe("Mai");
    const iso = new Date(2026, 8, 17, 14, 5).toISOString();
    expect(formatPortaleDateTime(iso)).toBe("17/09/2026 14:05");
  });

  it("distingue harvest scheda da scarico documenti", () => {
    expect(harvestRunAzione({
      id: "r1",
      documenti_nuovi: 0,
      documenti_aggiornati: 0,
      novita_json: { azione: "scheda" },
    })).toBe("scheda");
    expect(harvestRunAzione({
      id: "r2",
      documenti_nuovi: 0,
      documenti_aggiornati: 0,
      novita_json: { azione: "documenti" },
    })).toBe("documenti");
    expect(harvestRunAzione(
      { id: "r3", documenti_nuovi: 0, documenti_aggiornati: 0, novita_json: {} },
      [{ harvest_run_id: "r3" }],
    )).toBe("documenti");
    expect(harvestRunAzione({
      id: "r4",
      documenti_nuovi: 2,
      documenti_aggiornati: 0,
      novita_json: {},
    })).toBe("documenti");
  });

  it("prende l'ultima data di aggiornamento e di scarico", () => {
    const dates = lastPortaleAttivita({
      harvestAt: "2026-09-10T08:00:00.000Z",
      runs: [
        {
          id: "a",
          bando_id: "b1",
          avviato_il: "2026-09-16T10:00:00.000Z",
          concluso_il: "2026-09-16T10:01:00.000Z",
          esito: "ok",
          motore: "ted",
          documenti_nuovi: 0,
          documenti_aggiornati: 0,
          novita_json: { azione: "scheda" },
          errore: null,
        },
        {
          id: "b",
          bando_id: "b1",
          avviato_il: "2026-09-15T09:00:00.000Z",
          concluso_il: "2026-09-15T09:05:00.000Z",
          esito: "ok",
          motore: "ted",
          documenti_nuovi: 1,
          documenti_aggiornati: 0,
          novita_json: { azione: "documenti" },
          errore: null,
        },
      ],
      documenti: [{ harvest_run_id: "b", scaricato_il: "2026-09-15T09:04:00.000Z" }],
    });
    expect(dates.ultimoAggiornamento).toBe("2026-09-16T10:01:00.000Z");
    expect(dates.ultimoScarico).toBe("2026-09-15T09:05:00.000Z");
    expect(lastPortaleAttivita({}).ultimoAggiornamento).toBeNull();
    expect(lastPortaleAttivita({}).ultimoScarico).toBeNull();
  });
});
