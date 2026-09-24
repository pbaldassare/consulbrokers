import { describe, expect, it } from "vitest";
import { buildDuplicaTitoloPayload } from "../duplicaTitolo";

describe("buildDuplicaTitoloPayload", () => {
  const src = {
    id: "old-id",
    numero_titolo: "10633701",
    garanzia_da: "2025-01-01",
    garanzia_a: "2026-01-01",
    data_decorrenza: "2025-01-01",
    data_scadenza: "2026-01-01",
    data_competenza: "2025-01-01",
    data_messa_cassa: "2025-02-01",
    cig: "CIG123",
    stato: "sospeso",
    cliente_anagrafica_id: "cli-1",
    compagnia_id: "comp-1",
    premio_lordo: 1000,
  };

  it("non scrive data_decorrenza (colonna inesistente su titoli)", () => {
    const payload = buildDuplicaTitoloPayload(src, {
      numero: " 3434343334 ",
      decorrenza: "2026-09-24",
      scadenza: "2027-09-24",
    });
    expect(payload).not.toHaveProperty("data_decorrenza");
    expect(payload.numero_titolo).toBe("3434343334");
    expect(payload.garanzia_da).toBe("2026-09-24");
    expect(payload.garanzia_a).toBe("2027-09-24");
    expect(payload.data_scadenza).toBe("2027-09-24");
    expect(payload.data_competenza).toBe("2026-09-24");
    expect(payload.stato).toBe("attivo");
    expect(payload.cliente_anagrafica_id).toBe("cli-1");
    expect(payload.premio_lordo).toBe(1000);
    expect(payload.id).toBeUndefined();
    expect(payload.cig).toBeUndefined();
    expect(payload.data_messa_cassa).toBeUndefined();
  });
});
