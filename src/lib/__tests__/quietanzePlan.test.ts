import { describe, it, expect } from "vitest";
import { computeQuietanzePlan, computeQuietanzeOnly } from "../quietanzePlan";

const base = { garanziaDa: "2026-01-01", garanziaA: "2027-01-01", dataCompetenza: "2026-01-15" };

describe("computeQuietanzePlan", () => {
  it("polizza temporanea → una sola quietanza sul periodo indicato", () => {
    const plan = computeQuietanzePlan({
      polizzaTemporanea: true,
      garanziaDa: "2026-06-22",
      garanziaA: "2026-07-15",
      dataCompetenza: "2026-06-22",
    });
    expect(plan).toHaveLength(1);
    expect(plan[0]).toEqual({
      idx: 1,
      garanzia_da: "2026-06-22",
      garanzia_a: "2026-07-15",
      data_competenza: "2026-06-22",
    });
    expect(computeQuietanzeOnly({ polizzaTemporanea: true, garanziaDa: "2026-06-22", garanziaA: "2026-07-15" })).toHaveLength(0);
  });

  it("Annuale 1 anno → solo madre (1 riga)", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Annuale", anniDurata: 1 });
    expect(plan).toHaveLength(1);
    expect(computeQuietanzeOnly({ ...base, frazionamento: "Annuale", anniDurata: 1 })).toHaveLength(0);
  });

  it("Annuale 3 anni → 3 righe (madre + 2 quietanze)", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Annuale", anniDurata: 3 });
    expect(plan).toHaveLength(3);
    expect(plan[1].garanzia_da).toBe("2027-01-01");
    expect(plan[2].garanzia_da).toBe("2028-01-01");
  });

  it("Semestrale 1 anno → 2 righe (madre + 1 quietanza)", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Semestrale", anniDurata: 1 });
    expect(plan).toHaveLength(2);
    expect(plan[1].garanzia_da).toBe("2026-07-01");
    expect(plan[1].garanzia_a).toBe("2027-01-01");
  });

  it("Trimestrale 1 anno → 4 righe (madre + 3 quietanze)", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Trimestrale", anniDurata: 1 });
    expect(plan.map((r) => r.garanzia_da)).toEqual([
      "2026-01-01",
      "2026-04-01",
      "2026-07-01",
      "2026-10-01",
    ]);
  });

  it("Mensile 1 anno → 12 righe (madre + 11 quietanze)", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Mensile", anniDurata: 1 });
    expect(plan).toHaveLength(12);
    expect(plan[11].garanzia_da).toBe("2026-12-01");
  });

  it("Quadrimestrale 1 anno → 3 righe", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Quadrimestrale", anniDurata: 1 });
    expect(plan).toHaveLength(3);
    expect(plan[2].garanzia_da).toBe("2026-09-01");
  });

  it("Poliennale 3 anni → 3 quietanze annuali", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Poliennale", anniDurata: 3 });
    expect(plan).toHaveLength(3);
    expect(plan[0].garanzia_da).toBe("2026-01-01");
    expect(plan[1].garanzia_da).toBe("2027-01-01");
    expect(plan[2].garanzia_da).toBe("2028-01-01");
  });

  it("Poliennale 1 anno → 1 quietanza", () => {
    expect(computeQuietanzePlan({ ...base, frazionamento: "Poliennale", anniDurata: 1 })).toHaveLength(1);
  });

  it("data_competenza opzionale: trasla in parallelo alla garanzia", () => {
    const plan = computeQuietanzePlan({ ...base, frazionamento: "Semestrale", anniDurata: 1 });
    expect(plan[0].data_competenza).toBe("2026-01-15");
    expect(plan[1].data_competenza).toBe("2026-07-15");
  });

  it("senza garanzie → plan vuoto", () => {
    expect(computeQuietanzePlan({ frazionamento: "Mensile", anniDurata: 1 })).toEqual([]);
  });

  it("frazionamento mancante → plan vuoto", () => {
    expect(computeQuietanzePlan({ ...base, frazionamento: "", anniDurata: 1 })).toEqual([]);
  });

  it("polizza rateo semestrale → primo rateo libero + slot frazionamento fino a durata_a", () => {
    const plan = computeQuietanzePlan({
      polizzaRateo: true,
      frazionamento: "Semestrale",
      anniDurata: 1,
      garanziaDa: "2026-03-15",
      garanziaA: "2026-04-30",
      durataA: "2027-03-14",
    });
    expect(plan).toHaveLength(3);
    expect(plan[0]).toEqual({
      idx: 1,
      garanzia_da: "2026-03-15",
      garanzia_a: "2026-04-30",
      data_competenza: "2026-03-15",
    });
    expect(plan[1]).toEqual({
      idx: 2,
      garanzia_da: "2026-05-01",
      garanzia_a: "2026-11-01",
      data_competenza: "2026-05-01",
    });
    expect(plan[2]).toEqual({
      idx: 3,
      garanzia_da: "2026-11-01",
      garanzia_a: "2027-03-14",
      data_competenza: "2026-11-01",
    });
    expect(computeQuietanzeOnly({
      polizzaRateo: true,
      frazionamento: "Semestrale",
      garanziaDa: "2026-03-15",
      garanziaA: "2026-04-30",
      durataA: "2027-03-14",
    })).toHaveLength(2);
  });

  it("polizza rateo senza durata_a → plan vuoto", () => {
    expect(computeQuietanzePlan({
      polizzaRateo: true,
      frazionamento: "Semestrale",
      garanziaDa: "2026-03-15",
      garanziaA: "2026-04-30",
    })).toEqual([]);
  });

  it("polizza rateo annuale 1 anno → 2 quietanze (rateo + 1 rata annua)", () => {
    const plan = computeQuietanzePlan({
      polizzaRateo: true,
      frazionamento: "Annuale",
      anniDurata: 1,
      garanziaDa: "2026-03-15",
      garanziaA: "2026-06-30",
      durataA: "2027-03-14",
    });
    expect(plan).toHaveLength(2);
    expect(plan[0]).toEqual({
      idx: 1,
      garanzia_da: "2026-03-15",
      garanzia_a: "2026-06-30",
      data_competenza: "2026-03-15",
    });
    expect(plan[1]).toEqual({
      idx: 2,
      garanzia_da: "2026-07-01",
      garanzia_a: "2027-03-14",
      data_competenza: "2026-07-01",
    });
  });
});
