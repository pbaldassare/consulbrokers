import { describe, expect, it } from "vitest";
import { pianoCambioNumero } from "../pianoCambioNumero";

describe("pianoCambioNumero", () => {
  it("noop se numero vuoto o invariato", () => {
    expect(pianoCambioNumero({ id: "q", numero_titolo: "A", sostituisce_polizza: "A" }, "A")).toEqual({
      mode: "noop",
    });
    expect(pianoCambioNumero({ id: "q", numero_titolo: "A", sostituisce_polizza: "A" }, "  ")).toEqual({
      mode: "noop",
    });
  });

  it("quietanza con numero nuovo → stacco e diventa polizza", () => {
    expect(
      pianoCambioNumero(
        { id: "q1", numero_titolo: "POL-1", sostituisce_polizza: "POL-1" },
        "POL-2",
      ),
    ).toEqual({ mode: "detach-quietanza", titoloId: "q1", from: "POL-1", to: "POL-2" });
  });

  it("polizza con numero nuovo → rinomina catena", () => {
    expect(
      pianoCambioNumero(
        { id: "m1", numero_titolo: "POL-1", sostituisce_polizza: null },
        "POL-9",
      ),
    ).toEqual({ mode: "rename-chain", titoloId: "m1", from: "POL-1", to: "POL-9" });
  });

  it("appendice non si stacca come quietanza", () => {
    expect(
      pianoCambioNumero(
        {
          id: "am",
          numero_titolo: "POL-1/AM1",
          sostituisce_polizza: null,
          is_appendice_modifica: true,
        },
        "POL-1/AM2",
      ),
    ).toEqual({ mode: "rename-chain", titoloId: "am", from: "POL-1/AM1", to: "POL-1/AM2" });
  });
});
