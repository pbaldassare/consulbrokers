import { describe, expect, it } from "vitest";
import { dedupeTitoliMadreQuietanza } from "@/lib/titoliDaIncassare";

describe("dedupeTitoliMadreQuietanza", () => {
  it("tiene solo la quietanza se madre e figlia hanno stesso numero", () => {
    const madre = { id: "m1", numero_titolo: "313669193", sostituisce_polizza: null };
    const quietanza = { id: "q1", numero_titolo: "313669193", sostituisce_polizza: "madre-uuid" };
    expect(dedupeTitoliMadreQuietanza([madre, quietanza])).toEqual([quietanza]);
  });

  it("tiene la madre se non esiste quietanza collegata", () => {
    const madre = { id: "m1", numero_titolo: "999", sostituisce_polizza: null };
    expect(dedupeTitoliMadreQuietanza([madre])).toEqual([madre]);
  });

  it("non unisce numeri diversi", () => {
    const a = { id: "a", numero_titolo: "111", sostituisce_polizza: null };
    const b = { id: "b", numero_titolo: "222", sostituisce_polizza: "x" };
    expect(dedupeTitoliMadreQuietanza([a, b])).toEqual([a, b]);
  });
});
