import { describe, expect, it } from "vitest";
import {
  TITOLO_MODIFICA_LOCKED_INCASSO,
  titoloModificaLockedTooltip,
} from "../titoloModificaLocked";

describe("titoloModificaLockedTooltip", () => {
  it("nessun tooltip se il titolo non è locked", () => {
    expect(titoloModificaLockedTooltip({ isLocked: false, stato: "attivo" })).toBeUndefined();
  });

  it("incassato: testo esatto (gia senza accento) su polizza e quietanza", () => {
    expect(
      titoloModificaLockedTooltip({ isLocked: true, stato: "incassato", isPolizzaMadre: true }),
    ).toBe(TITOLO_MODIFICA_LOCKED_INCASSO);
    expect(
      titoloModificaLockedTooltip({ isLocked: true, stato: "incassato", isPolizzaMadre: false }),
    ).toBe(TITOLO_MODIFICA_LOCKED_INCASSO);
    expect(TITOLO_MODIFICA_LOCKED_INCASSO).toBe(
      "Non puoi effettuare modifiche se l'incasso è gia stato effettuato, annulla prima l'incasso.",
    );
  });

  it("stornato: messaggio specifico per polizza/quietanza", () => {
    expect(titoloModificaLockedTooltip({ isLocked: true, stato: "stornato", isPolizzaMadre: true })).toBe(
      "Polizza stornata: modifiche bloccate",
    );
    expect(titoloModificaLockedTooltip({ isLocked: true, stato: "stornato", isPolizzaMadre: false })).toBe(
      "Quietanza stornata: modifiche bloccate",
    );
  });

  it("locked senza incasso (messa a cassa): messaggio descrittivo", () => {
    expect(titoloModificaLockedTooltip({ isLocked: true, stato: "attivo", isPolizzaMadre: true })).toBe(
      "Polizza messa a cassa: modifiche bloccate",
    );
    expect(titoloModificaLockedTooltip({ isLocked: true, stato: "attivo", isPolizzaMadre: false })).toBe(
      "Quietanza messa a cassa: modifiche bloccate",
    );
  });
});
