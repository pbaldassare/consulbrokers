import { describe, expect, it } from "vitest";
import { hrefPolizzaContratto, hrefQuietanzaDettaglio, hrefTitoloDettaglio } from "@/lib/polizzaNavigation";
import { rowHref } from "@/lib/portafoglioCarico/filters";

describe("hrefTitoloDettaglio", () => {
  it("restituisce /titoli/:id", () => {
    expect(hrefTitoloDettaglio("abc")).toBe("/titoli/abc");
    expect(hrefTitoloDettaglio(null)).toBeNull();
  });
});

describe("rowHref", () => {
  it("polizza madre → titolo", () => {
    expect(rowHref({ id: "t1", sostituisce_polizza: null })).toBe("/titoli/t1");
  });

  it("quietanza / appendice → titolo (non quietanze/:id)", () => {
    expect(rowHref({ id: "q1", sostituisce_polizza: "POL-1", quietanza_id: "qz-1" })).toBe("/titoli/q1");
    expect(rowHref({ id: "am1", is_appendice_modifica: true })).toBe("/titoli/am1");
    expect(rowHref({ id: "rg1", is_regolazione: true })).toBe("/titoli/rg1");
  });

  it("fallback legacy senza id titolo", () => {
    expect(rowHref({ quietanza_id: "qz-1" })).toBe("/quietanze/qz-1");
    expect(rowHref({ polizza_id: "p1" })).toBe("/polizze/p1");
  });
});

describe("hrefQuietanzaDettaglio", () => {
  it("preferisce titolo", () => {
    expect(hrefQuietanzaDettaglio({ titoloId: "t1", quietanzaId: "q1" })).toBe("/titoli/t1");
    expect(hrefQuietanzaDettaglio({ quietanzaId: "q1" })).toBe("/quietanze/q1");
  });
});

describe("hrefPolizzaContratto", () => {
  it("preferisce titolo madre", () => {
    expect(hrefPolizzaContratto({ titoloId: "t1", polizzaId: "p1" })).toBe("/titoli/t1");
    expect(hrefPolizzaContratto({ polizzaId: "p1" })).toBe("/polizze/p1");
  });
});
