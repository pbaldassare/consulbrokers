import { describe, expect, it } from "vitest";
import {
  buildPrescrizioneBiennaleAgenzia,
  calcScadenzaPrescrizioneBiennale,
  PRESCRIZIONE_DESTINATARIO_AGENZIA,
  REMINDER_LIST_DEFAULT_STATI,
  reminderListSeesAllSedi,
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

  it("elenco reminder globale include attivi e completati (come scheda pratica)", () => {
    expect(REMINDER_LIST_DEFAULT_STATI).toEqual(["attivo", "completato"]);
  });

  it("visibilità elenco reminder: admin/cfo tutte le sedi, ufficio no", () => {
    expect(reminderListSeesAllSedi("admin")).toBe(true);
    expect(reminderListSeesAllSedi("cfo")).toBe(true);
    expect(reminderListSeesAllSedi("ufficio")).toBe(false);
    expect(reminderListSeesAllSedi("backoffice")).toBe(false);
    expect(reminderListSeesAllSedi("produttore")).toBe(false);
  });
});
