import { describe, expect, it } from "vitest";
import {
  STATI_SOSTITUZIONE_GESTIONE,
  isPolizzaSostituibileStato,
} from "@/lib/gestionePolizzeStati";

describe("gestionePolizzeStati", () => {
  it("include incassato tra gli stati sostituibili (prima rata già incassata)", () => {
    expect(STATI_SOSTITUZIONE_GESTIONE).toContain("incassato");
    expect(isPolizzaSostituibileStato("incassato")).toBe(true);
  });

  it("esclude stati bloccati come annullato ed estinto", () => {
    expect(isPolizzaSostituibileStato("annullato")).toBe(false);
    expect(isPolizzaSostituibileStato("estinto")).toBe(false);
  });

  it("consente attivo e sospeso", () => {
    expect(isPolizzaSostituibileStato("attivo")).toBe(true);
    expect(isPolizzaSostituibileStato("sospeso")).toBe(true);
  });
});
