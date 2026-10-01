import { describe, expect, it } from "vitest";
import {
  applyPortafoglioTipoOrder,
  comparePortafoglioTipo,
  isTipoSortField,
  portafoglioTipoRank,
  TIPO_SORT_FIELD,
} from "../portafoglioTipoSort";

describe("portafoglioTipoSort", () => {
  it("riconosce il campo sort tipo", () => {
    expect(isTipoSortField(TIPO_SORT_FIELD)).toBe(true);
    expect(isTipoSortField("garanzia_a")).toBe(false);
  });

  it("ordina polizza → quietanza → regolazione → proroga → appendice", () => {
    const rows = [
      { is_appendice_modifica: true },
      { is_proroga: true },
      { is_regolazione: true },
      { sostituisce_polizza: "P1" },
      { sostituisce_polizza: null },
    ];
    const sorted = [...rows].sort(comparePortafoglioTipo);
    expect(sorted.map(portafoglioTipoRank)).toEqual([0, 1, 2, 3, 4]);
  });

  it("applyPortafoglioTipoOrder concatena i 4 order sui flag", () => {
    const calls: Array<{ col: string; ascending: boolean }> = [];
    const builder = {
      order(col: string, opts: { ascending: boolean }) {
        calls.push({ col, ascending: opts.ascending });
        return this;
      },
    };
    applyPortafoglioTipoOrder(builder, true);
    expect(calls.map((c) => c.col)).toEqual([
      "is_appendice_modifica",
      "is_proroga",
      "is_regolazione",
      "sostituisce_polizza",
    ]);
    expect(calls.every((c) => c.ascending)).toBe(true);
  });
});
