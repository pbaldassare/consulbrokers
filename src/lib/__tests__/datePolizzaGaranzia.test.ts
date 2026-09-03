import { describe, it, expect } from "vitest";
import { datePeriodoPolizzaGaranzia, extremaDate, compareText } from "../datePolizzaGaranzia";

describe("datePeriodoPolizzaGaranzia", () => {
  it("fine polizza usa la quietanza più lunga anche se durata_a è ferma al primo anno", () => {
    const head = {
      durata_da: "2026-06-29",
      durata_a: "2027-06-29",
      garanzia_da: "2026-06-29",
      garanzia_a: "2027-06-29",
    };
    const rate = [
      { garanzia_da: "2026-06-29", garanzia_a: "2027-06-29" },
      { garanzia_da: "2027-06-29", garanzia_a: "2028-06-29" },
    ];
    const d = datePeriodoPolizzaGaranzia(head, rate);
    expect(d.inizioPolizza).toBe("2026-06-29");
    expect(d.finePolizza).toBe("2028-06-29");
    expect(d.inizioGaranzia).toBe("2027-06-29");
    expect(d.fineGaranzia).toBe("2028-06-29");
  });

  it("senza rate usa le date della madre", () => {
    const d = datePeriodoPolizzaGaranzia({
      garanzia_da: "2026-01-01",
      garanzia_a: "2027-01-01",
    });
    expect(d.inizioGaranzia).toBe("2026-01-01");
    expect(d.fineGaranzia).toBe("2027-01-01");
    expect(d.inizioPolizza).toBe("2026-01-01");
    expect(d.finePolizza).toBe("2027-01-01");
  });
});

describe("compareText", () => {
  it("ordina in italiano e inverte con desc", () => {
    expect(compareText("RCA", "Furto", "asc")).toBeGreaterThan(0);
    expect(compareText("RCA", "Furto", "desc")).toBeLessThan(0);
  });
});

describe("extremaDate", () => {
  it("min e max", () => {
    expect(extremaDate(["2027-01-01", "2026-01-01"], "min")).toBe("2026-01-01");
    expect(extremaDate(["2027-01-01", "2026-01-01"], "max")).toBe("2027-01-01");
    expect(extremaDate([null, ""], "max")).toBeNull();
  });
});
