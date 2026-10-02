import { describe, expect, it } from "vitest";
import {
  creditoDaPremioLordo,
  isTitoloACredito,
  segnaAnticipoRimborsato,
} from "@/lib/anticipoDaTitoloCredito";

describe("creditoDaPremioLordo", () => {
  it("ritorna 0 su premi positivi o null", () => {
    expect(creditoDaPremioLordo(150)).toBe(0);
    expect(creditoDaPremioLordo(0)).toBe(0);
    expect(creditoDaPremioLordo(null)).toBe(0);
  });

  it("ritorna valore assoluto su premi negativi", () => {
    expect(creditoDaPremioLordo(-150)).toBe(150);
    expect(creditoDaPremioLordo(-150.456)).toBe(150.46);
  });
});

describe("isTitoloACredito", () => {
  it("true solo con lordo negativo", () => {
    expect(isTitoloACredito({ premio_lordo: -150, is_appendice_modifica: true })).toBe(true);
    expect(isTitoloACredito({ premio_lordo: 5570, is_appendice_modifica: true })).toBe(false);
  });
});

describe("segnaAnticipoRimborsato", () => {
  it("richiede sempre il conto bancario di uscita", async () => {
    const result = await segnaAnticipoRimborsato({} as any, "anticipo-1", {
      dataRimborso: "2026-10-02",
      contoBancarioId: "",
    });

    expect(result).toEqual({ ok: false, error: "Seleziona il conto di uscita del rimborso" });
  });

  it("salva nello storico importo residuo, conto, data, note e operatore", async () => {
    const updates: Record<string, unknown>[] = [];
    const fakeSupabase = {
      from: (table: string) => {
        if (table === "conti_bancari") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: "conto-1", attivo: true }, error: null }),
              }),
            }),
          };
        }

        return {
          select: (columns: string) => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: columns === "note"
                  ? { note: "Credito da appendice" }
                  : { id: "anticipo-1", importo: 100, importo_residuo: 37.456, rimborsato_il: null },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            updates.push(payload);
            return { eq: async () => ({ error: null }) };
          },
        };
      },
    };

    const result = await segnaAnticipoRimborsato(fakeSupabase as any, "anticipo-1", {
      dataRimborso: "2026-10-02",
      contoBancarioId: "conto-1",
      note: "CRO 123",
      userId: "utente-1",
    });

    expect(result).toEqual({ ok: true, importoRimborsato: 37.46 });
    expect(updates).toContainEqual(expect.objectContaining({
      importo_residuo: 0,
      rimborsato_il: "2026-10-02",
      rimborsato_importo: 37.46,
      rimborsato_conto_bancario_id: "conto-1",
      rimborsato_note: "CRO 123",
      rimborsato_da: "utente-1",
    }));
  });
});
