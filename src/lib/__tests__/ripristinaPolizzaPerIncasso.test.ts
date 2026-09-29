import { describe, expect, it } from "vitest";
import { puoAprireIncasso } from "../ripristinaPolizzaPerIncasso";

describe("puoAprireIncasso", () => {
  it("attivo senza cassa: sì", () => {
    expect(puoAprireIncasso("attivo", null)).toBe(true);
  });

  it("annullato senza cassa: sì (la polizza è la prima rata)", () => {
    expect(puoAprireIncasso("annullato", null)).toBe(true);
  });

  it("incassato: no", () => {
    expect(puoAprireIncasso("incassato", "2026-09-01")).toBe(false);
  });

  it("sospeso: no", () => {
    expect(puoAprireIncasso("sospeso", null)).toBe(false);
  });

  it("attivo già in cassa: no, salvo poliennale o garantito aperto", () => {
    expect(puoAprireIncasso("attivo", "2026-09-01")).toBe(false);
    expect(puoAprireIncasso("attivo", "2026-09-01", { poliennale: true })).toBe(true);
    expect(puoAprireIncasso("attivo", "2026-09-01", { garantitoAperto: true })).toBe(true);
  });
});
