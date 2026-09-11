import { describe, expect, it } from "vitest";
import {
  EMPTY_SINISTRI_FILTERS,
  hasSinistriFilters,
  sanitizePostgrestTerm,
  sinistriFilterChips,
} from "@/lib/sinistriListSearch";

describe("sanitizePostgrestTerm", () => {
  it("toglie caratteri che rompono il filtro PostgREST", () => {
    expect(sanitizePostgrestTerm("  varese,(ig)  ")).toBe("varese ig");
    expect(sanitizePostgrestTerm("50%")).toBe("50");
  });
});

describe("sinistriFilterChips", () => {
  it("non emette chip se i filtri sono vuoti", () => {
    expect(sinistriFilterChips(EMPTY_SINISTRI_FILTERS)).toEqual([]);
    expect(hasSinistriFilters(EMPTY_SINISTRI_FILTERS)).toBe(false);
  });

  it("compone chip combinabili per cliente, controparte e tipo", () => {
    const chips = sinistriFilterChips({
      ...EMPTY_SINISTRI_FILTERS,
      clienteId: "c1",
      clienteLabel: "Comune di Varese",
      controparte: "Ignoti",
      tipo: "furto",
    }, "Furto");
    expect(chips.map((c) => c.label)).toEqual([
      "Cliente: Comune di Varese",
      "Controparte: Ignoti",
      "Tipo: Furto",
    ]);
    expect(hasSinistriFilters({
      ...EMPTY_SINISTRI_FILTERS,
      clienteId: "c1",
      clienteLabel: "Comune di Varese",
    })).toBe(true);
  });
});
