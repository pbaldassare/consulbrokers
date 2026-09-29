import { describe, expect, it } from "vitest";
import { cfCheckChar, inventCodiceFiscale, inventPartitaIva } from "@/lib/inventFiscalIds";
import { validateCF } from "@/lib/validateCF";
import { validatePIVA } from "@/lib/validatePIVA";

describe("inventPartitaIva", () => {
  it("genera P.IVA unica con checksum italiano", () => {
    const taken = new Set<string>();
    const a = inventPartitaIva("MI:014024:_nuovo_cliente", taken);
    const b = inventPartitaIva("PZ:000493:altro", taken);
    expect(validatePIVA(a).valid).toBe(true);
    expect(validatePIVA(b).valid).toBe(true);
    expect(a).not.toBe(b);
    expect(taken.has(a)).toBe(true);
    expect(inventPartitaIva("MI:014024:_nuovo_cliente", new Set())).toBe(a);
  });
});

describe("inventCodiceFiscale", () => {
  it("genera CF 16 caratteri valido e deterministico", () => {
    const taken = new Set<string>();
    const cf = inventCodiceFiscale({
      seed: "MI:010001:ROSSI MARIO",
      cognome: "ROSSI",
      nome: "MARIO",
      comune: "F205",
      taken,
    });
    expect(cf).toHaveLength(16);
    expect(validateCF(cf, { allowPIVAFormat: false }).valid).toBe(true);
    expect(cf.slice(0, 6)).toBe("RSSMRA");
    expect(cf[15]).toBe(cfCheckChar(cf.slice(0, 15)));
    expect(
      inventCodiceFiscale({
        seed: "MI:010001:ROSSI MARIO",
        cognome: "ROSSI",
        nome: "MARIO",
        comune: "F205",
      }),
    ).toBe(cf);
  });
});
