import { describe, expect, it } from "vitest";
import { sumImportoProvvPassive } from "@/lib/premiProvvigioni/provvPassiveFromGenerate";

describe("sumImportoProvvPassive", () => {
  it("somma solo commerciale e ae, non admin", () => {
    const tot = sumImportoProvvPassive([
      { tipo_destinatario: "commerciale", importo_provvigione: 52.56, solo_statistico: false },
      { tipo_destinatario: "admin", importo_provvigione: 44.5, solo_statistico: false },
      { tipo_destinatario: "ae", importo_provvigione: 10, solo_statistico: false },
      { tipo_destinatario: "commerciale", importo_provvigione: 99, solo_statistico: true },
    ]);
    expect(tot).toBe(62.56);
  });
});
