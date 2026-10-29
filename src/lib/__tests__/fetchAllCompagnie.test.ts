import { describe, expect, it, vi } from "vitest";
import { fetchAllCompagnie } from "@/lib/fetchAllCompagnie";
import * as movimenti from "@/lib/movimentiBancari";

describe("fetchAllCompagnie", () => {
  it("delega a fetchAllQueryPages", async () => {
    const spy = vi.spyOn(movimenti, "fetchAllQueryPages").mockResolvedValue([{ id: "1" }]);
    const rows = await fetchAllCompagnie("id", { attiva: true });
    expect(rows).toEqual([{ id: "1" }]);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
