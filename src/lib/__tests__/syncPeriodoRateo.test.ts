import { describe, it, expect } from "vitest";
import { syncPeriodoRateo } from "../syncPeriodoRateo";

describe("syncPeriodoRateo", () => {
  it("allinea data competenza a garanzia da", () => {
    expect(syncPeriodoRateo({ garanziaDa: "2026-03-15" })).toEqual({
      data_competenza: "2026-03-15",
    });
  });

  it("restituisce stringa vuota se garanzia da manca", () => {
    expect(syncPeriodoRateo({ garanziaDa: "" })).toEqual({
      data_competenza: "",
    });
  });
});
