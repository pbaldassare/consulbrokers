import { describe, it, expect } from "vitest";

/**
 * Replica della guardia usata nel useEffect di NuovoClienteDialog
 * per l'assegnazione automatica del profilo backoffice.
 *
 * Verifichiamo:
 *  1. Non sovrascrive un profilo già impostato (idempotenza → no re-render).
 *  2. Imposta il profilo solo quando mancante.
 *  3. Non tocca altri campi (initialData / controlledOpen restano integri).
 */
type CommercialRole = {
  profilo_id: string | null;
  percentuale?: number | null;
  // campi popolati eventualmente da initialData
  [key: string]: unknown;
};

const backofficeUpdater =
  (backofficeProfileId: string | null) =>
  (prev: CommercialRole): CommercialRole => {
    if (!backofficeProfileId) return prev;
    if (prev.profilo_id) return prev;
    if (prev.profilo_id === backofficeProfileId) return prev;
    return { ...prev, profilo_id: backofficeProfileId };
  };

describe("NuovoClienteDialog - backoffice auto-assign guard", () => {
  it("non sovrascrive profilo_id se già valorizzato", () => {
    const prev: CommercialRole = { profilo_id: "existing-id", percentuale: 10 };
    const next = backofficeUpdater("backoffice-id")(prev);
    expect(next).toBe(prev); // stessa reference → React no-op
    expect(next.profilo_id).toBe("existing-id");
  });

  it("imposta profilo_id quando mancante", () => {
    const prev: CommercialRole = { profilo_id: null, percentuale: 5 };
    const next = backofficeUpdater("backoffice-id")(prev);
    expect(next).not.toBe(prev);
    expect(next.profilo_id).toBe("backoffice-id");
    expect(next.percentuale).toBe(5);
  });

  it("no-op se backofficeProfileId è null (query non ancora pronta)", () => {
    const prev: CommercialRole = { profilo_id: null };
    const next = backofficeUpdater(null)(prev);
    expect(next).toBe(prev);
  });

  it("non tocca campi extra provenienti da initialData", () => {
    const prev: CommercialRole = {
      profilo_id: null,
      percentuale: 7,
      noteInitialData: "from-initialData",
    };
    const next = backofficeUpdater("backoffice-id")(prev);
    expect(next.noteInitialData).toBe("from-initialData");
    expect(next.percentuale).toBe(7);
    expect(next.profilo_id).toBe("backoffice-id");
  });

  it("idempotente su chiamate multiple (riapertura dialog)", () => {
    let state: CommercialRole = { profilo_id: null };
    const update = backofficeUpdater("backoffice-id");
    state = update(state);
    const afterFirst = state;
    state = update(state);
    state = update(state);
    expect(state).toBe(afterFirst); // nessuna nuova reference dopo la prima
  });
});
