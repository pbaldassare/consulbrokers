import { describe, expect, it } from "vitest";
import { combineRegistroDateTime } from "@/lib/registroAttivitaDateTime";

describe("combineRegistroDateTime", () => {
  const day = new Date(2026, 9, 16);

  it("usa inizio/fine giornata se ora assente", () => {
    const da = combineRegistroDateTime(day, "", "da");
    const a = combineRegistroDateTime(day, "", "a");
    expect(da).toBeTruthy();
    expect(a).toBeTruthy();
    expect(new Date(da!).getHours()).toBe(0);
    expect(new Date(a!).getHours()).toBe(23);
  });

  it("combina data e ora esplicita", () => {
    const iso = combineRegistroDateTime(day, "14:30:00", "da");
    const d = new Date(iso!);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });
});
