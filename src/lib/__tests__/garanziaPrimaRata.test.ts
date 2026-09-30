import { describe, expect, it } from "vitest";
import { erroreGaranziaPrimaRata } from "@/lib/garanziaPrimaRata";

describe("erroreGaranziaPrimaRata", () => {
  it("polizza triennale con garanzia dall'anno dopo: errore", () => {
    const err = erroreGaranziaPrimaRata({ durataDa: "2025-07-31", garanziaDa: "2026-07-31" });
    expect(err).toContain("31/07/2026");
    expect(err).toContain("31/07/2025");
  });

  it("garanzia che parte da Durata Da: ok", () => {
    expect(erroreGaranziaPrimaRata({ durataDa: "2025-07-31", garanziaDa: "2025-07-31" })).toBeNull();
  });

  it("temporanea e rateo esclusi", () => {
    expect(erroreGaranziaPrimaRata({ durataDa: "2025-07-31", garanziaDa: "2025-09-01", temporanea: true })).toBeNull();
    expect(erroreGaranziaPrimaRata({ durataDa: "2025-07-31", garanziaDa: "2025-09-01", rateo: true })).toBeNull();
  });

  it("date mancanti: nessun errore", () => {
    expect(erroreGaranziaPrimaRata({ durataDa: "", garanziaDa: "2025-07-31" })).toBeNull();
  });
});
