import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, getUser, insert } = vi.hoisted(() => ({
  invoke: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke },
    auth: { getUser },
    from: vi.fn(() => ({ insert })),
  },
}));

import {
  invokeNotificaMessaCassa,
  scheduleOrInvokeNotificaMessaCassa,
} from "@/lib/notificaMessaCassa";

describe("notifica messa a cassa per modalità di pagamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoke.mockResolvedValue({ data: { ok: true, invii_ok: 1 }, error: null });
  });

  it("incasso_zero non invoca né accoda la notifica", async () => {
    const result = await scheduleOrInvokeNotificaMessaCassa(["titolo-1"], {
      serale: true,
      tipoPagamento: "incasso_zero",
    });

    expect(result).toMatchObject({
      mode: "skipped",
      data: { ok: true, skipped: true, reason: "incasso_zero" },
      error: null,
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("mantiene invariato l'invio per le altre modalità", async () => {
    const result = await scheduleOrInvokeNotificaMessaCassa(["titolo-1"], {
      tipoPagamento: "bonifico",
    });

    expect(result.mode).toBe("sent");
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith("notifica-messa-cassa-agenzia", {
      body: {
        force: false,
        flush_coda: true,
        titolo_id: "titolo-1",
      },
    });
  });

  it("blocca incasso_zero anche sull'invocazione diretta", async () => {
    const result = await invokeNotificaMessaCassa(["titolo-1"], {
      force: true,
      tipoPagamento: "incasso_zero",
    });

    expect(result.data).toMatchObject({ skipped: true, reason: "incasso_zero" });
    expect(invoke).not.toHaveBeenCalled();
  });
});
