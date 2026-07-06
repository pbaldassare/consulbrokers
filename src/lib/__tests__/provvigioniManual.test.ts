import { describe, expect, it } from "vitest";
import {
  isProvvigioniManualStored,
  provvigioniImportoFromPct,
  provvigioniPctFromImporto,
} from "@/lib/provvigioniManual";

describe("provvigioniManual", () => {
  it("isProvvigioniManualStored rileva anche micro-differenze", () => {
    expect(isProvvigioniManualStored(200.01, 200.0)).toBe(true);
    expect(isProvvigioniManualStored(200.0, 200.0)).toBe(false);
  });

  it("provvigioniImportoFromPct non tronca la % a 4 decimali", () => {
    const base = 5919.83;
    const importo = 200.33;
    const pct = provvigioniPctFromImporto(importo, base);
    const ricalc = provvigioniImportoFromPct(base, pct);
    expect(Math.abs(ricalc - importo)).toBeLessThan(0.005);
  });

  it("provvigioniPctFromImporto mantiene precisione per display", () => {
    const pct = provvigioniPctFromImporto(200.33, 5919.83);
    expect(pct).not.toBe("3.3858");
    expect(parseFloat(pct)).toBeCloseTo(3.38405, 4);
  });
});
