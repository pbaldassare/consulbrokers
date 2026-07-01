import { describe, expect, it } from "vitest";
import { fetchAppendiciPolizzaForTitoli } from "@/lib/appendiciPolizza";

function mockSupabase(rowsByTable: Record<string, unknown[]>) {
  const from = (table: string) => ({
    select: () => ({
      in: async () => ({ data: rowsByTable[table] ?? [], error: null }),
    }),
  });
  return { from } as any;
}

describe("fetchAppendiciPolizzaForTitoli", () => {
  it("deduplica e ordina per created_at desc", async () => {
    const supabase = mockSupabase({
      appendici_polizza: [
        { id: "a1", titolo_id: "m1", numero_appendice: "1", created_at: "2026-01-01" },
        { id: "a1", titolo_id: "m1", numero_appendice: "1", created_at: "2026-01-01" },
        { id: "a2", quietanza_id: "q1", numero_appendice: "2", created_at: "2026-06-01" },
      ],
    });
    const res = await fetchAppendiciPolizzaForTitoli(supabase, ["m1", "q1"]);
    expect(res).toHaveLength(2);
    expect(res[0].id).toBe("a2");
  });
});
