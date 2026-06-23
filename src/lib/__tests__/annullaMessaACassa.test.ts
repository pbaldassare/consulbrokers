import { describe, it, expect, vi, beforeEach } from "vitest";

const { logAttivita, fromMock } = vi.hoisted(() => ({
  logAttivita: vi.fn().mockResolvedValue(undefined),
  fromMock: vi.fn(),
}));

type ChainResult = { data: unknown; error: null | { message: string } };

function makeChain(final: ChainResult) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ["select", "eq", "limit", "delete", "update", "insert"]) {
    chain[m] = vi.fn(self);
  }
  chain.then = (resolve: (v: ChainResult) => void) => Promise.resolve(final).then(resolve);
  chain.single = vi.fn().mockResolvedValue(final);
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

vi.mock("@/lib/logAttivita", () => ({ logAttivita }));

import { annullaMessaACassa } from "../annullaMessaACassa";

describe("annullaMessaACassa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocca se esistono provvigioni già pagate", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "provvigioni_generate") {
        return makeChain({ data: [{ id: "prov-1" }], error: null });
      }
      return makeChain({ data: null, error: null });
    });

    const res = await annullaMessaACassa("titolo-1");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/provvigioni già pagate/i);
  });

  it("propaga errore query provvigioni pagate", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "provvigioni_generate") {
        return makeChain({ data: null, error: { message: "DB down" } });
      }
      return makeChain({ data: null, error: null });
    });

    const res = await annullaMessaACassa("titolo-1");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("DB down");
  });

  it("completa annullamento: elimina provvigioni/movimenti e resetta titolo", async () => {
    let call = 0;
    fromMock.mockImplementation((table: string) => {
      call += 1;
      if (table === "provvigioni_generate" && call === 1) {
        return makeChain({ data: [], error: null });
      }
      if (table === "provvigioni_generate") {
        const c = makeChain({ data: [{ id: "p1" }, { id: "p2" }], error: null });
        c.select = vi.fn(() => c);
        return c;
      }
      if (table === "movimenti_contabili") {
        const c = makeChain({ data: [{ id: "m1" }], error: null });
        c.select = vi.fn(() => c);
        return c;
      }
      if (table === "cliente_anticipi_utilizzi" || table === "titoli_compensazioni") {
        return makeChain({ data: null, error: null });
      }
      if (table === "titoli") {
        return makeChain({ data: null, error: null });
      }
      return makeChain({ data: null, error: null });
    });

    const res = await annullaMessaACassa("titolo-abc");
    expect(res.ok).toBe(true);
    expect(res.provvigioniEliminate).toBe(2);
    expect(res.movimentiEliminati).toBe(1);
    expect(logAttivita).toHaveBeenCalledWith(
      expect.objectContaining({
        azione: "annulla_messa_a_cassa",
        entita_tipo: "titolo",
        entita_id: "titolo-abc",
      }),
    );
  });

  it("propaga errore eliminazione movimenti contabili", async () => {
    let provCall = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "provvigioni_generate") {
        provCall += 1;
        if (provCall === 1) return makeChain({ data: [], error: null });
        const c = makeChain({ data: [], error: null });
        c.select = vi.fn(() => c);
        return c;
      }
      if (table === "movimenti_contabili") {
        const c = makeChain({ data: null, error: { message: "FK violation" } });
        c.select = vi.fn(() => c);
        return c;
      }
      return makeChain({ data: null, error: null });
    });

    const res = await annullaMessaACassa("titolo-x");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("FK violation");
  });
});
