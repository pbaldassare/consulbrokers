import { describe, expect, it } from "vitest";
import { buildIncassoDateFields, resolveDataCoperturaOnIncasso } from "@/lib/garantitoTitolo";

describe("resolveDataCoperturaOnIncasso", () => {
  it("incasso diretto: copertura = messa a cassa", () => {
    expect(resolveDataCoperturaOnIncasso({ conferimento_gestito: false }, "2026-06-29")).toBe("2026-06-29");
  });

  it("garantito con copertura: mantiene data originale", () => {
    expect(
      resolveDataCoperturaOnIncasso(
        { conferimento_gestito: true, data_copertura: "2026-06-15" },
        "2026-06-29",
      ),
    ).toBe("2026-06-15");
  });

  it("garantito senza copertura salvata: fallback a messa a cassa", () => {
    expect(resolveDataCoperturaOnIncasso({ conferimento_gestito: true }, "2026-06-29")).toBe("2026-06-29");
  });
});

describe("buildIncassoDateFields", () => {
  it("allinea incasso e messa a cassa; copertura distinta se garantito", () => {
    const out = buildIncassoDateFields(
      { conferimento_gestito: true, data_copertura: "2026-06-15" },
      "2026-06-29",
    );
    expect(out).toEqual({
      data_messa_cassa: "2026-06-29",
      data_incasso: "2026-06-29",
      data_copertura: "2026-06-15",
    });
  });
});
