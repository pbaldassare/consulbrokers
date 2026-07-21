import { describe, expect, it } from "vitest";
import { formatIsoDateOnly, parseIsoDateOnly } from "@/components/ui/date-input";

describe("date-input ISO helpers", () => {
  it("parseIsoDateOnly legge yyyy-MM-dd senza shift timezone", () => {
    const d = parseIsoDateOnly("2026-07-21");
    expect(d).toBeTruthy();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(6);
    expect(d!.getDate()).toBe(21);
  });

  it("formatIsoDateOnly produce yyyy-MM-dd", () => {
    expect(formatIsoDateOnly(new Date(2026, 6, 21))).toBe("2026-07-21");
  });

  it("accetta ISO con orario prendendo solo la data", () => {
    const d = parseIsoDateOnly("2026-07-21T12:00:00.000Z");
    expect(d?.getDate()).toBe(21);
    expect(d?.getMonth()).toBe(6);
  });
});
