import { describe, expect, it } from "vitest";
import {
  buildPrescrizioneBiennaleAgenzia,
  calcScadenzaPrescrizioneBiennale,
  PRESCRIZIONE_DESTINATARIO_AGENZIA,
} from "@/lib/sinistroPrescrizioniReminder";

describe("sinistroPrescrizioniReminder", () => {
  it("calcola scadenza biennale da data denuncia", () => {
    expect(calcScadenzaPrescrizioneBiennale("2026-08-04")).toBe("2028-08-04");
  });

  it("costruisce prescrizione automatica verso agenzia di riferimento", () => {
    const draft = buildPrescrizioneBiennaleAgenzia("2026-08-04", "AG. MILANO FILIBERTO");
    expect(draft).toMatchObject({
      destinatario_tipo: PRESCRIZIONE_DESTINATARIO_AGENZIA,
      destinatario_label: "AG. MILANO FILIBERTO",
      data_scadenza_risposta: "2028-08-04",
    });
    expect(draft?.oggetto).toContain("2952");
  });
});
