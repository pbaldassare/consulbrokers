import { describe, expect, it } from "vitest";
import {
  applyFiltroPortaleCliente,
  applyStatoFiltroLista,
  applyStatoFiltroOperativo,
  excludeArchiviati,
  isArchiviato,
  isSinistroAperto,
  isSinistroTerminale,
  labelStatoSinistro,
  resolveStatoFiltroLista,
  SINISTRO_STATO_ARCHIVIATO,
  SINISTRO_STATI_OPERATIVI,
  statiVisibiliDefault,
} from "../sinistriStati";

describe("isArchiviato / aperti", () => {
  it("riconosce archiviato in modo case-insensitive", () => {
    expect(isArchiviato("archiviato")).toBe(true);
    expect(isArchiviato("Archiviato")).toBe(true);
    expect(isArchiviato("aperto")).toBe(false);
    expect(isArchiviato(null)).toBe(false);
  });

  it("tratta archiviato come terminale, non aperto", () => {
    expect(isSinistroTerminale("archiviato")).toBe(true);
    expect(isSinistroAperto("archiviato")).toBe(false);
    expect(isSinistroAperto("aperto")).toBe(true);
    expect(isSinistroAperto("chiuso")).toBe(false);
    expect(isSinistroAperto("respinto")).toBe(false);
  });
});

describe("statiVisibiliDefault", () => {
  it("esclude archiviato dalla lista operativa", () => {
    expect(statiVisibiliDefault()).toEqual(SINISTRO_STATI_OPERATIVI);
    expect(statiVisibiliDefault()).not.toContain(SINISTRO_STATO_ARCHIVIATO);
    expect(statiVisibiliDefault()).toContain("bozza");
    expect(statiVisibiliDefault()).toContain("respinto");
  });
});

describe("labelStatoSinistro", () => {
  it("usa label UI Archiviato", () => {
    expect(labelStatoSinistro("archiviato")).toBe("Archiviato");
    expect(labelStatoSinistro("bozza")).toBe("Bozza");
    expect(labelStatoSinistro("in_valutazione")).toBe("In valutazione");
    expect(labelStatoSinistro("")).toBe("—");
  });
});

describe("resolveStatoFiltroLista", () => {
  it("tab normali + tutti = neq archiviato", () => {
    expect(resolveStatoFiltroLista({ tab: "elenco", stato: "tutti" })).toEqual({
      kind: "neq",
      value: "archiviato",
    });
    expect(resolveStatoFiltroLista({ tab: "ricerca" })).toEqual({
      kind: "neq",
      value: "archiviato",
    });
  });

  it("tab archiviati forza solo archiviato", () => {
    expect(resolveStatoFiltroLista({ tab: "archiviati", stato: "aperto" })).toEqual({
      kind: "eq",
      value: "archiviato",
    });
  });

  it("filtro esplicito (anche archiviato) su tab normali", () => {
    expect(resolveStatoFiltroLista({ tab: "elenco", stato: "aperto" })).toEqual({
      kind: "eq",
      value: "aperto",
    });
    expect(resolveStatoFiltroLista({ tab: "elenco", stato: "archiviato" })).toEqual({
      kind: "eq",
      value: "archiviato",
    });
  });
});

describe("applyStatoFiltroLista / portale / operativo", () => {
  function mockQuery() {
    const calls: Array<{ op: string; col: string; val: unknown }> = [];
    const q = {
      eq(col: string, val: string) {
        calls.push({ op: "eq", col, val });
        return q;
      },
      neq(col: string, val: string) {
        calls.push({ op: "neq", col, val });
        return q;
      },
      in(col: string, val: string[]) {
        calls.push({ op: "in", col, val });
        return q;
      },
      calls,
    };
    return q;
  }

  it("applica neq archiviato sul portale cliente", () => {
    const q = mockQuery();
    applyFiltroPortaleCliente(q);
    expect(q.calls).toEqual([{ op: "neq", col: "stato", val: "archiviato" }]);
  });

  it("lista default e tab archiviati", () => {
    const a = mockQuery();
    applyStatoFiltroLista(a, { tab: "elenco", stato: "tutti" });
    expect(a.calls).toEqual([{ op: "neq", col: "stato", val: "archiviato" }]);

    const b = mockQuery();
    applyStatoFiltroLista(b, { tab: "archiviati" });
    expect(b.calls).toEqual([{ op: "eq", col: "stato", val: "archiviato" }]);
  });

  it("filtro operativo: default nasconde, selezione esplicita include", () => {
    const a = mockQuery();
    applyStatoFiltroOperativo(a, []);
    expect(a.calls).toEqual([{ op: "neq", col: "stato", val: "archiviato" }]);

    const b = mockQuery();
    applyStatoFiltroOperativo(b, ["archiviato"], "sinistri.stato");
    expect(b.calls).toEqual([{ op: "in", col: "sinistri.stato", val: ["archiviato"] }]);
  });
});

describe("excludeArchiviati", () => {
  it("toglie le pratiche archiviate da export/report", () => {
    const rows = [
      { id: "1", stato: "aperto" },
      { id: "2", stato: "archiviato" },
      { id: "3", stato: "chiuso" },
    ];
    expect(excludeArchiviati(rows).map((r) => r.id)).toEqual(["1", "3"]);
  });
});
