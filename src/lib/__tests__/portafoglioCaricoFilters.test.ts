import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyPeriodoFilter, parsePeriodoParam, periodoLabel, type Periodo } from "../portafoglioCarico/filters";

type FakeQuery = {
  calls: string[];
  eq: (c: string, v: unknown) => FakeQuery;
  or: (f: string) => FakeQuery;
  gte: (c: string, v: unknown) => FakeQuery;
  lte: (c: string, v: unknown) => FakeQuery;
};

/** Query builder finto: registra le chiamate fatte dal filtro. */
function fakeQuery() {
  const calls: string[] = [];
  const q: FakeQuery = {
    calls,
    eq: (c: string, v: unknown) => (calls.push(`eq:${c}:${v}`), q),
    or: (f: string) => (calls.push(`or:${f}`), q),
    gte: (c: string, v: unknown) => (calls.push(`gte:${c}:${v}`), q),
    lte: (c: string, v: unknown) => (calls.push(`lte:${c}:${v}`), q),
  };
  return q;
}

const pendenti = (filtroPeriodo: Periodo, dateDa = "", dateA = "") =>
  applyPeriodoFilter(fakeQuery(), { isVistaIncassati: false, dateDa, dateA, filtroPeriodo }).calls as string[];

describe("filtro periodo Carico del mese", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("parte da Arretrati + mese e accetta solo valori noti", () => {
    expect(parsePeriodoParam(null)).toBe("mese_corrente");
    expect(parsePeriodoParam("messe_cassa")).toBe("mese_corrente");
    expect(parsePeriodoParam("prossimi_60")).toBe("prossimi_60");
    expect(parsePeriodoParam("tutte")).toBe("tutte");
  });

  it("Arretrati + mese: inizio garanzia entro fine mese corrente", () => {
    const calls = pendenti("mese_corrente");
    expect(calls).toContain("eq:stato:attivo");
    expect(calls.at(-1)).toBe("or:garanzia_da.is.null,garanzia_da.lte.2026-10-31");
  });

  it("Prossimi 60 gg: inizio garanzia entro oggi + 60 giorni, appendici sempre", () => {
    const last = pendenti("prossimi_60").at(-1)!;
    expect(last).toContain("garanzia_da.lte.2026-12-06");
    expect(last).toContain("is_appendice_modifica.eq.true");
  });

  it("Tutto: nessun limite di data sui pendenti", () => {
    const calls = pendenti("tutte");
    expect(calls.some((c) => c.includes("garanzia_da.lte"))).toBe(false);
  });

  it("Dal/Al ha la precedenza sul periodo", () => {
    const calls = pendenti("mese_corrente", "2026-11-01", "2026-11-30");
    expect(calls).toContain("gte:garanzia_da:2026-11-01");
    expect(calls).toContain("lte:garanzia_da:2026-11-30");
    expect(calls.some((c) => c.includes("2026-10-31"))).toBe(false);
  });

  it("etichette chiare per pendenti e incassati", () => {
    expect(periodoLabel("mese_corrente", false)).toBe("Arretrati + mese");
    expect(periodoLabel("prossimi_60", false)).toBe("Prossimi 60 gg");
    expect(periodoLabel("tutte", false)).toBe("Tutto");
    expect(periodoLabel("mese_corrente", true)).toBe("Mese corrente");
    expect(periodoLabel("tutte", true)).toBe("Tutto");
  });
});
