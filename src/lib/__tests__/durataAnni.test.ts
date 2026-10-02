import { describe, expect, it } from "vitest";
import { addCalendarYearsISO, calcolaAnniDurata } from "@/lib/durataAnni";

describe("calcolaAnniDurata", () => {
  it.each([
    ["2026-10-02", "2027-10-02", 1],
    ["2026-10-02", "2028-10-02", 2],
    ["2026-10-02", "2031-10-02", 5],
  ])("calcola %s → %s come %i anni", (dal, al, attesi) => {
    expect(calcolaAnniDurata(dal, al)).toBe(attesi);
  });

  it("usa anniversari di calendario anche attraversando un anno bisestile", () => {
    expect(calcolaAnniDurata("2023-03-01", "2024-03-01")).toBe(1);
    expect(calcolaAnniDurata("2024-02-29", "2025-03-01")).toBe(1);
    expect(addCalendarYearsISO("2024-02-29", 1)).toBe("2025-03-01");
  });

  it.each([
    [null, "2028-10-02"],
    ["2026-10-02", null],
    ["2026-10", "2028-10-02"],
    ["2026-02-30", "2028-02-28"],
    ["2028-10-02", "2026-10-02"],
  ])("non sincronizza date mancanti, parziali o invalide (%s, %s)", (dal, al) => {
    expect(calcolaAnniDurata(dal, al)).toBeNull();
  });
});
