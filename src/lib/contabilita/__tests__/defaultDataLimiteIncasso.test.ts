import { describe, it, expect } from "vitest";
import {
  defaultDataLimiteIncassoIso,
  defaultPeriodoDalAgenzia,
  EC_AGENZIE_DAL,
  isDefaultPeriodoDalAgenzia,
  isIncassoNelPeriodoEcAgenzia,
  resolvePeriodoDalAgenzia,
  resolvePeriodoDalAgenziaIso,
} from "../defaultDataLimiteIncasso";

const iso = (y: number, m0: number, d: number) =>
  defaultDataLimiteIncassoIso(new Date(y, m0, d, 12, 0, 0));

describe("defaultDataLimiteIncasso", () => {
  it("in settembre (anche prima dell'11) è il 30 settembre", () => {
    expect(iso(2026, 8, 1)).toBe("2026-09-30");
    expect(iso(2026, 8, 7)).toBe("2026-09-30");
    expect(iso(2026, 8, 11)).toBe("2026-09-30");
    expect(iso(2026, 8, 30)).toBe("2026-09-30");
  });

  it("fino al 10 ottobre resta il 30 settembre", () => {
    expect(iso(2026, 9, 1)).toBe("2026-09-30");
    expect(iso(2026, 9, 10)).toBe("2026-09-30");
  });

  it("dall'11 ottobre al 10 novembre è fine ottobre", () => {
    expect(iso(2026, 9, 11)).toBe("2026-10-31");
    expect(iso(2026, 9, 31)).toBe("2026-10-31");
    expect(iso(2026, 10, 10)).toBe("2026-10-31");
  });

  it("dall'11 novembre è fine novembre", () => {
    expect(iso(2026, 10, 11)).toBe("2026-11-30");
  });

  it("a cavallo d'anno: 1–10 gennaio = 31 dicembre", () => {
    expect(iso(2027, 0, 10)).toBe("2026-12-31");
    expect(iso(2027, 0, 11)).toBe("2027-01-31");
  });
});

describe("E/C agenzie dal 1 settembre 2026", () => {
  it("il default è il 1 settembre 2026", () => {
    expect(formatYmd(defaultPeriodoDalAgenzia())).toBe(EC_AGENZIE_DAL);
    expect(resolvePeriodoDalAgenziaIso(null)).toBe("2026-09-01");
    expect(resolvePeriodoDalAgenziaIso("")).toBe("2026-09-01");
    expect(isDefaultPeriodoDalAgenzia(null)).toBe(true);
    expect(isDefaultPeriodoDalAgenzia(new Date(2026, 8, 1))).toBe(true);
  });

  it("date precedenti al go-live vengono alzate al 1 settembre", () => {
    expect(resolvePeriodoDalAgenziaIso("2026-08-31")).toBe("2026-09-01");
    expect(resolvePeriodoDalAgenziaIso("2025-01-15")).toBe("2026-09-01");
    expect(formatYmd(resolvePeriodoDalAgenzia(new Date(2026, 7, 31)))).toBe("2026-09-01");
    expect(formatYmd(resolvePeriodoDalAgenzia(null))).toBe("2026-09-01");
  });

  it("date dal 1 settembre in poi restano invariate", () => {
    expect(resolvePeriodoDalAgenziaIso("2026-09-01")).toBe("2026-09-01");
    expect(resolvePeriodoDalAgenziaIso("2026-09-15T10:00:00")).toBe("2026-09-15");
    expect(resolvePeriodoDalAgenziaIso("2026-10-01")).toBe("2026-10-01");
    expect(formatYmd(resolvePeriodoDalAgenzia(new Date(2026, 9, 1)))).toBe("2026-10-01");
    expect(isDefaultPeriodoDalAgenzia(new Date(2026, 9, 1))).toBe(false);
  });

  it("i PDF / E/C agenzia tengono solo incassi dal 1 settembre", () => {
    expect(isIncassoNelPeriodoEcAgenzia("2026-08-31")).toBe(false);
    expect(isIncassoNelPeriodoEcAgenzia("2026-09-01")).toBe(true);
    expect(isIncassoNelPeriodoEcAgenzia("2026-09-01T18:30:00")).toBe(true);
    expect(isIncassoNelPeriodoEcAgenzia("2026-10-05")).toBe(true);
    expect(isIncassoNelPeriodoEcAgenzia(null)).toBe(false);
    expect(isIncassoNelPeriodoEcAgenzia("2026-08-20", "2026-09-15")).toBe(false);
    expect(isIncassoNelPeriodoEcAgenzia("2026-09-15", "2026-09-15")).toBe(true);
  });
});

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
