import { describe, expect, it } from "vitest";
import {
  applyCassaSearch,
  applyRiepilogoCassaDate,
  labelPeriodoCassa,
  rangeDateCassa,
  sanitizeCassaSearch,
  tipoIncassoCassaLabel,
  viewRowToTitoloCassa,
} from "../riepilogoMesseACassa";

describe("rangeDateCassa", () => {
  const now = new Date(2026, 9, 15); // 15 ott 2026

  it("Dal/Al vincono sul toggle mese", () => {
    expect(
      rangeDateCassa({
        dateDa: "2026-01-01",
        dateA: "2026-01-31",
        filtroPeriodo: "mese_corrente",
        now,
      }),
    ).toEqual({ da: "2026-01-01", a: "2026-01-31" });
  });

  it("solo Dal senza Al", () => {
    expect(
      rangeDateCassa({ dateDa: "2026-09-01", dateA: "", filtroPeriodo: "tutte", now }),
    ).toEqual({ da: "2026-09-01", a: null });
  });

  it("mese corrente se nessun Dal/Al", () => {
    expect(rangeDateCassa({ dateDa: "", dateA: "", filtroPeriodo: "mese_corrente", now })).toEqual({
      da: "2026-10-01",
      a: "2026-10-31",
    });
  });

  it("tutte = nessun range", () => {
    expect(rangeDateCassa({ dateDa: "", dateA: "", filtroPeriodo: "tutte", now })).toEqual({
      da: null,
      a: null,
    });
  });
});

describe("labelPeriodoCassa", () => {
  const now = new Date(2026, 9, 15);

  it("mostra Dal/Al in italiano", () => {
    expect(
      labelPeriodoCassa({ dateDa: "2026-01-02", dateA: "2026-01-20", filtroPeriodo: "mese_corrente", now }),
    ).toBe("02/01/2026 – 20/01/2026");
  });

  it("mese corrente capitalizzato da date-fns it", () => {
    expect(labelPeriodoCassa({ dateDa: "", dateA: "", filtroPeriodo: "mese_corrente", now })).toMatch(/ottobre 2026/i);
  });

  it("tutte le date", () => {
    expect(labelPeriodoCassa({ dateDa: "", dateA: "", filtroPeriodo: "tutte", now })).toBe("Tutte le date");
  });
});

describe("sanitizeCassaSearch / applyCassaSearch", () => {
  it("toglie wildcard e virgole pericolose", () => {
    expect(sanitizeCassaSearch("  Rossi, (abc%)  ")).toBe("Rossi abc");
  });

  it("non applica .or se vuoto", () => {
    const q = { or: () => "called" };
    expect(applyCassaSearch(q, "   ")).toBe(q);
  });

  it("applica .or con termine pulito", () => {
    let received = "";
    const q = { or: (s: string) => { received = s; return "ok"; } };
    expect(applyCassaSearch(q, "AXA*")).toBe("ok");
    expect(received).toContain("numero_titolo.ilike.%AXA%");
    expect(received).toContain("compagnia_nome.ilike.%AXA%");
  });
});

describe("applyRiepilogoCassaDate", () => {
  it("esclude data cassa null e applica range mese", () => {
    const calls: string[] = [];
    const q = {
      not: (col: string, op: string, val: unknown) => {
        calls.push(`not:${col}:${op}:${val}`);
        return q;
      },
      gte: (col: string, val: string) => {
        calls.push(`gte:${col}:${val}`);
        return q;
      },
      lte: (col: string, val: string) => {
        calls.push(`lte:${col}:${val}`);
        return q;
      },
    };
    applyRiepilogoCassaDate(q, {
      dateDa: "",
      dateA: "",
      filtroPeriodo: "mese_corrente",
      now: new Date(2026, 8, 3),
    });
    expect(calls).toEqual([
      "not:data_messa_cassa:is:null",
      "gte:data_messa_cassa:2026-09-01",
      "lte:data_messa_cassa:2026-09-30",
    ]);
  });
});

describe("viewRowToTitoloCassa", () => {
  it("mappa la vista sul tipo TitoloCassa", () => {
    const t = viewRowToTitoloCassa({
      id: "t1",
      numero_titolo: "123",
      data_messa_cassa: "2026-10-01",
      cliente_anagrafica_id: "c1",
      numero_rata: 2,
      premio_lordo: 100,
      provvigioni_firma: 10,
      provvigioni_quietanza: 5,
      compagnia_id: "ag1",
      compagnia_nome: "Agenzia X",
      cliente_nome_display: "Rossi Mario",
      conferimento_gestito: true,
      fondi_ricevuti: false,
      sostituisce_polizza: "p1",
    });
    expect(t.id).toBe("t1");
    expect(t.tipo).toBe("quietanza");
    expect(t.riga).toBe(2);
    expect(t.compagnie?.nome).toBe("Agenzia X");
    expect(t.clienti?.ragione_sociale).toBe("Rossi Mario");
    expect(t.tipo_pagamento).toBeNull();
  });
});

describe("tipoIncassoCassaLabel", () => {
  it("distinguie diretto / garantito / in attesa", () => {
    expect(tipoIncassoCassaLabel({})).toBe("Incasso diretto");
    expect(tipoIncassoCassaLabel({ conferimento_gestito: true, fondi_ricevuti: true })).toBe("Cop. Garantita");
    expect(tipoIncassoCassaLabel({ conferimento_gestito: true, fondi_ricevuti: false })).toBe("In Attesa Fondi");
  });
});
