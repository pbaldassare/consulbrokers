import { describe, expect, it } from "vitest";
import { isCatenaModelloVecchio, scegliPrimaQuietanza } from "../promuoviPrimaQuietanza";

describe("scegliPrimaQuietanza", () => {
  it("prende la prima per garanzia_da, poi riga", () => {
    const prima = scegliPrimaQuietanza([
      { id: "q2", sostituisce_polizza: "P", garanzia_da: "2026-07-01", riga: 3 },
      { id: "q1", sostituisce_polizza: "P", garanzia_da: "2026-01-01", riga: 2 },
    ]);
    expect(prima?.id).toBe("q1");
  });

  it("ignora appendici e la madre", () => {
    expect(
      scegliPrimaQuietanza([
        { id: "m", sostituisce_polizza: null, garanzia_da: "2026-01-01" },
        { id: "am", sostituisce_polizza: "P", is_appendice_modifica: true, garanzia_da: "2026-01-01" },
      ]),
    ).toBeNull();
  });
});

describe("isCatenaModelloVecchio", () => {
  it("true se madre e prima quietanza condividono periodo e premio", () => {
    expect(
      isCatenaModelloVecchio(
        { id: "m", sostituisce_polizza: null, garanzia_da: "2026-01-01", premio_lordo: 1000 },
        [{ id: "q", sostituisce_polizza: "P", garanzia_da: "2026-01-01", premio_lordo: 1000 }],
      ),
    ).toBe(true);
  });

  it("false nel nuovo modello (periodi diversi)", () => {
    expect(
      isCatenaModelloVecchio(
        { id: "m", sostituisce_polizza: null, garanzia_da: "2026-01-01", premio_lordo: 500 },
        [{ id: "q", sostituisce_polizza: "P", garanzia_da: "2026-07-01", premio_lordo: 500 }],
      ),
    ).toBe(false);
  });
});
