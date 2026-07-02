import { describe, it, expect } from "vitest";
import { emptyGaranziaRow, type GaranziaRow } from "@/components/polizze/PremiGaranziaCardShell";
import {
  calcProvvigioniGaranzia,
  calcTasseRiga,
  calcLordoGaranziaRow,
  resolveRowPctAccessori,
  type MatriceProvvAccessori,
} from "@/lib/calcProvvigioniGaranzia";

const matrice: MatriceProvvAccessori = {
  pctByRamoId: new Map([["sotto-1", 15]]),
  pctAccessoriByRamoId: new Map([["sotto-1", 10]]),
  pctDefault: 12,
  pctAccessoriDefault: 8,
  pctPrevalente: 15,
  isUniform: false,
};

const row = (over: Partial<GaranziaRow> = {}): GaranziaRow => ({
  ...emptyGaranziaRow(),
  sottoramoId: "sotto-1",
  netto: "100",
  accessori: "20",
  ...over,
});

describe("calcTasseRiga", () => {
  it("calcola tasse su imponibile netto + accessori", () => {
    expect(calcTasseRiga(100, 20, 2.5)).toBe(3);
  });
});

describe("calcLordoGaranziaRow", () => {
  it("diritti agenzia: lordo = solo tasse", () => {
    expect(calcLordoGaranziaRow({ ...emptyGaranziaRow(), dirittiAgenzia: true, tasse: "22" })).toBe(22);
  });

  it("garanzia standard: netto + accessori + tasse + ssn", () => {
    expect(
      calcLordoGaranziaRow({ ...emptyGaranziaRow(), netto: "100", tasse: "22", ssn: "0" }),
    ).toBe(122);
  });

  it("rettifica tasse: aumenta lordo senza cambiare provvigioni", () => {
    const base = row({ netto: "100", accessori: "20", tasse: "3" });
    const conRett = row({ netto: "100", accessori: "20", tasse: "3", tasseRettifica: "0.50" });
    expect(calcProvvigioniGaranzia([base], matrice)).toBe(calcProvvigioniGaranzia([conRett], matrice));
    expect(calcLordoGaranziaRow(conRett)).toBeCloseTo(calcLordoGaranziaRow(base) + 0.5, 2);
  });

  it("rettifica negativa riduce lordo", () => {
    const r = row({ netto: "100", accessori: "", tasse: "22", tasseRettifica: "-1.00" });
    expect(calcLordoGaranziaRow(r)).toBe(121);
  });
});

describe("calcProvvigioniGaranzia", () => {
  it("somma provvigione su netto e su accessori con % distinte", () => {
    const provv = calcProvvigioniGaranzia([row()], matrice);
    // 100 * 15% + 20 * 10% = 15 + 2 = 17
    expect(provv).toBeCloseTo(17, 2);
  });

  it("usa fallback % accessori = % netto quando non configurata", () => {
    const m: MatriceProvvAccessori = {
      ...matrice,
      pctAccessoriByRamoId: new Map(),
    };
    const provv = calcProvvigioniGaranzia([row()], m);
    // 100 * 15% + 20 * 15% = 18
    expect(provv).toBeCloseTo(18, 2);
  });

  it("esclude righe con escludiProvvigioni", () => {
    expect(calcProvvigioniGaranzia([row({ escludiProvvigioni: true })], matrice)).toBe(0);
  });

  it("esclude righe diritti di agenzia (solo tasse)", () => {
    expect(calcProvvigioniGaranzia([row({ dirittiAgenzia: true, netto: "", tasse: "50" })], matrice)).toBe(0);
  });
});

describe("resolveRowPctAccessori", () => {
  it("rispetta override manuale sulla riga", () => {
    const r = resolveRowPctAccessori(row({ provvAccessoriPct: 5 }), matrice);
    expect(r.pct).toBe(5);
    expect(r.matched).toBe(true);
  });
});
