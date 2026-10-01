import { describe, expect, it } from "vitest";
import { dataMessaCassaEffettiva, isDataMessaCassaCompilata } from "../messaCassaDate";

describe("isDataMessaCassaCompilata", () => {
  it("vuoto / null non vale (default senza data)", () => {
    expect(isDataMessaCassaCompilata("")).toBe(false);
    expect(isDataMessaCassaCompilata("   ")).toBe(false);
    expect(isDataMessaCassaCompilata(null)).toBe(false);
    expect(isDataMessaCassaCompilata(undefined)).toBe(false);
  });

  it("ISO yyyy-mm-dd è valida", () => {
    expect(isDataMessaCassaCompilata("2026-10-01")).toBe(true);
  });
});

describe("dataMessaCassaEffettiva", () => {
  it("usa l'override riga se compilato", () => {
    expect(dataMessaCassaEffettiva("2026-10-01", "2026-09-15")).toBe("2026-09-15");
  });

  it("altrimenti la data globale", () => {
    expect(dataMessaCassaEffettiva("2026-10-01", "")).toBe("2026-10-01");
    expect(dataMessaCassaEffettiva("2026-10-01", null)).toBe("2026-10-01");
  });
});
