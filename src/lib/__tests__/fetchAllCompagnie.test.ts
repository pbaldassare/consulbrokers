import { describe, expect, it, vi } from "vitest";
import { fetchAllCompagnie, mappaGruppiDaRapporti } from "@/lib/fetchAllCompagnie";
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

describe("mappaGruppiDaRapporti", () => {
  it("tiene tutti i gruppi dello stesso broker", () => {
    const map = mappaGruppiDaRapporti([
      { compagnia_id: "etisicura", gruppo_compagnia_id: "unipol" },
      { compagnia_id: "etisicura", gruppo_compagnia_id: "verti" },
      { compagnia_id: "etisicura", gruppo_compagnia_id: "unipol" },
      { compagnia_id: null, gruppo_compagnia_id: "unipol" },
    ]);
    expect(map.etisicura).toEqual(["unipol", "verti"]);
  });
});
