import { describe, it, expect } from "vitest";
import { isConsulbrokersContoTipo, validateContoBancarioSedi } from "../contiBancariSedi";

describe("validateContoBancarioSedi", () => {
  it("non richiede sedi per tipi entità", () => {
    expect(validateContoBancarioSedi("agenzia", [])).toEqual({ valid: true });
    expect(validateContoBancarioSedi("broker", [])).toEqual({ valid: true });
  });

  it("blocca Consulbrokers senza sedi", () => {
    const res = validateContoBancarioSedi("incasso_clienti", []);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/almeno una sede/i);
  });

  it("accetta Consulbrokers con almeno una sede", () => {
    expect(validateContoBancarioSedi("generico", ["uuid-1"])).toEqual({ valid: true });
    expect(validateContoBancarioSedi("provvigioni", ["a", "b"])).toEqual({ valid: true });
  });

  it("isConsulbrokersContoTipo", () => {
    expect(isConsulbrokersContoTipo("incasso_clienti")).toBe(true);
    expect(isConsulbrokersContoTipo("agenzia")).toBe(false);
    expect(isConsulbrokersContoTipo(null)).toBe(false);
  });
});
