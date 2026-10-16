import { describe, expect, it } from "vitest";
import { parseAddressText } from "@/lib/parseAddressText";

describe("parseAddressText", () => {
  it("estrae via, CAP, città e provincia da stringa formattata", () => {
    const parsed = parseAddressText("Via Roma 12, 20121 Milano MI, Italia");
    expect(parsed.indirizzo).toContain("Via Roma");
    expect(parsed.cap).toBe("20121");
    expect(parsed.citta).toMatch(/Milano/i);
    expect(parsed.provincia).toBe("MI");
  });

  it("restituisce campi vuoti per testo senza struttura", () => {
    const parsed = parseAddressText("cortile interno ospedale");
    expect(parsed.indirizzo).toBeTruthy();
    expect(parsed.cap).toBe("");
    expect(parsed.citta).toBe("");
    expect(parsed.provincia).toBe("");
  });
});
