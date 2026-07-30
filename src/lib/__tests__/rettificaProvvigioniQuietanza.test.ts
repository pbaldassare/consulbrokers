import { describe, it, expect } from "vitest";
import {
  calcDeltaProvvigioni,
  splitDeltaProporzionale,
  validateNuovoImporto,
  validateRettificaNote,
  formatRataLabel,
} from "../rettificaProvvigioniQuietanza";

describe("calcDeltaProvvigioni", () => {
  it("calcola delta arrotondato a 2 decimali", () => {
    expect(calcDeltaProvvigioni(100, 125.5)).toBe(25.5);
    expect(calcDeltaProvvigioni(100.333, 100.33)).toBe(-0);
    expect(calcDeltaProvvigioni(null, 50)).toBe(50);
  });
});

describe("validateRettificaNote", () => {
  it("richiede note non vuote", () => {
    expect(validateRettificaNote("")).toMatch(/obbligatorie/);
    expect(validateRettificaNote("   ")).toMatch(/obbligatorie/);
    expect(validateRettificaNote("abc")).toMatch(/min\. 5/);
    expect(validateRettificaNote("Rettifica per errore importo")).toBeNull();
  });
});

describe("validateNuovoImporto", () => {
  it("accetta zero e rifiuta negativi", () => {
    expect(validateNuovoImporto(0)).toBeNull();
    expect(validateNuovoImporto(-1)).toMatch(/negativo/);
    expect(validateNuovoImporto(undefined)).toMatch(/obbligatorio/);
  });
});

describe("splitDeltaProporzionale", () => {
  const template = [
    { percentuale: 60, importo_provvigione: 60, tipo_destinatario: "commerciale" },
    { percentuale: 40, importo_provvigione: 40, tipo_destinatario: "admin", solo_statistico: false },
  ];

  it("ripartisce il delta in proporzione", () => {
    const rows = splitDeltaProporzionale(10, template);
    expect(rows).toHaveLength(2);
    const sum = rows.reduce((s, r) => s + (r.importo_provvigione ?? 0), 0);
    expect(sum).toBe(10);
    expect(rows[0].importo_provvigione).toBe(6);
    expect(rows[1].importo_provvigione).toBe(4);
  });

  it("delta zero → nessuna riga", () => {
    expect(splitDeltaProporzionale(0, template)).toEqual([]);
  });
});

describe("formatRataLabel", () => {
  it("formatta rata/totale", () => {
    expect(formatRataLabel(2, 4)).toBe("2/4");
    expect(formatRataLabel(null, 4)).toBe("—");
  });
});
