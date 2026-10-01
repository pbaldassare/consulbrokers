import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import { matchClientiDaOrdinantiBatch, normalizeNomeMatch, searchBitsOrdinante } from "@/lib/matchClienteOrdinante";

describe("matchClientiDaOrdinantiBatch", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("una sola RPC per tutti i token distinti del file e match per ordinante", async () => {
    rpcMock.mockImplementation(async (_fn: string, args: { p_tokens: string[] }) => ({
      data: args.p_tokens.flatMap((t) =>
        t === "CIALLELLA" || t === "STEFANO"
          ? [{ token: t, id: "cli-1", ragione_sociale: null, nome: "Stefano", cognome: "Ciallella", ufficio_id: "u1" }]
          : [],
      ),
      error: null,
    }));

    const out = await matchClientiDaOrdinantiBatch([
      { ordinante: "CIALLELLA STEFANO", descrizione: null },
      { ordinante: "Ciallella Stefano", descrizione: null },
      { ordinante: "SCONOSCIUTO MARIO", descrizione: null },
    ]);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const tokens = rpcMock.mock.calls[0][1].p_tokens as string[];
    expect(new Set(tokens)).toEqual(new Set(["CIALLELLA", "STEFANO", "SCONOSCIUTO", "MARIO"]));
    expect(out.get(normalizeNomeMatch("CIALLELLA STEFANO"))).toMatchObject({ cliente_id: "cli-1", ufficio_id: "u1" });
    expect(out.has(normalizeNomeMatch("SCONOSCIUTO MARIO"))).toBe(false);
  });

  it("nessuna RPC se non ci sono ordinanti cercabili", async () => {
    const out = await matchClientiDaOrdinantiBatch([{ ordinante: "AB", descrizione: null }]);
    expect(out.size).toBe(0);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("searchBitsOrdinante usa il nome normalizzato se non ci sono token lunghi", () => {
    expect(searchBitsOrdinante("ABC SRL")).toEqual(["ABC SRL"]);
    expect(searchBitsOrdinante("x")).toEqual([]);
  });
});
