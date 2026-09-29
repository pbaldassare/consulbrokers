import { describe, it, expect } from "vitest";
import {
  applySedeContoDefault,
  applySedeContoToggle,
  isConsulbrokersContoTipo,
  seedSedeContiSelection,
  validateContoBancarioSedi,
} from "../contiBancariSedi";
import { formatContoBancarioSaveError } from "../contiBancariSediDb";

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

describe("formatContoBancarioSaveError", () => {
  it("traduce errore sedi minime", () => {
    expect(
      formatContoBancarioSaveError({
        message: "I conti Consulbrokers devono avere almeno una sede abilitata.",
      }),
    ).toMatch(/almeno una sede/i);
  });

  it("traduce errore permessi RLS", () => {
    expect(
      formatContoBancarioSaveError({ message: "new row violates row-level security policy" }),
    ).toMatch(/permessi/i);
  });

  it("usa messaggio generico se assente", () => {
    expect(formatContoBancarioSaveError({})).toMatch(/salvataggio/i);
  });

  it("riporta il blocco scollega-ultimo-conto", () => {
    expect(
      formatContoBancarioSaveError({
        message: 'Il conto "BCC" è collegato solo a questa sede: abilitalo su un\'altra sede.',
      }),
    ).toMatch(/collegato solo a questa sede/i);
  });
});

describe("selezione conti sede", () => {
  it("seed unisce link N:N e default", () => {
    expect(seedSedeContiSelection(["a", "b"], "c")).toEqual({
      selectedIds: ["a", "b", "c"],
      defaultId: "c",
    });
    expect(seedSedeContiSelection(["a"], null)).toEqual({
      selectedIds: ["a"],
      defaultId: "a",
    });
  });

  it("toggle aggiunge e imposta il primo default", () => {
    const next = applySedeContoToggle({ selectedIds: [], defaultId: null }, "a", true);
    expect(next).toEqual({ selectedIds: ["a"], defaultId: "a" });
    expect(applySedeContoToggle(next, "b", true)).toEqual({
      selectedIds: ["a", "b"],
      defaultId: "a",
    });
  });

  it("toggle toglie e riassegna il default", () => {
    const start = { selectedIds: ["a", "b"], defaultId: "a" };
    expect(applySedeContoToggle(start, "a", false)).toEqual({
      selectedIds: ["b"],
      defaultId: "b",
    });
  });

  it("imposta default solo se selezionato", () => {
    const start = { selectedIds: ["a", "b"], defaultId: "a" };
    expect(applySedeContoDefault(start, "b")).toEqual({
      selectedIds: ["a", "b"],
      defaultId: "b",
    });
    expect(applySedeContoDefault(start, "z")).toEqual(start);
  });
});
