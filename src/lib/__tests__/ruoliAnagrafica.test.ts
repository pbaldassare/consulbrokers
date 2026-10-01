import { describe, expect, it } from "vitest";
import { aeCoincideConProduttore, haRuolo, labelRuoli, ruoliDi } from "@/lib/ruoliAnagrafica";

describe("ruoliAnagrafica", () => {
  it("usa ruoli quando presenti, altrimenti tipo", () => {
    expect(ruoliDi({ tipo: "corrispondente", ruoli: ["corrispondente", "account_executive"] })).toEqual([
      "corrispondente",
      "account_executive",
    ]);
    expect(ruoliDi({ tipo: "account_executive", ruoli: [] })).toEqual(["account_executive"]);
    expect(ruoliDi(null)).toEqual([]);
  });

  it("haRuolo riconosce i ruoli aggiuntivi", () => {
    const a = { tipo: "corrispondente", ruoli: ["corrispondente", "responsabile_sede"] };
    expect(haRuolo(a, "responsabile_sede")).toBe(true);
    expect(haRuolo(a, "account_executive")).toBe(false);
  });

  it("labelRuoli elenca i ruoli in italiano", () => {
    expect(labelRuoli({ tipo: "corrispondente", ruoli: ["corrispondente", "account_executive"] })).toBe(
      "Produttore · AE",
    );
  });

  it("AE uguale a un produttore: vince il produttore", () => {
    expect(aeCoincideConProduttore("a", ["b", "a"])).toBe(true);
    expect(aeCoincideConProduttore("a", ["b", null])).toBe(false);
    expect(aeCoincideConProduttore(null, ["a"])).toBe(false);
  });
});
