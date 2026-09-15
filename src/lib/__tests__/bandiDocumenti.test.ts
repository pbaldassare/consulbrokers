import { describe, expect, it } from "vitest";
import {
  buildHarvestNote,
  classifyDocumentoHash,
  countNovitaDocumenti,
  inferTipoDocumentoBando,
  labelStatoDocumentoBando,
  labelTipoDocumentoBando,
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
    expect(labelTipoDocumentoBando("capitolato")).toBe("Capitolato");
    expect(labelStatoDocumentoBando("nuovo")).toBe("Nuovo");
  });
});
