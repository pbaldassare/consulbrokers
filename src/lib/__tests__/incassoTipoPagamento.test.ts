import { describe, expect, it } from "vitest";
import { resolveTipoPagamentoTitoloIncasso } from "@/lib/incassoTipoPagamento";

describe("resolveTipoPagamentoTitoloIncasso", () => {
  it("bonifico principale con acconti → bonifico (non anticipo_misto)", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 40,
        residuoCash: 60,
        haCompensazioni: false,
        tipoPagamentoPrincipale: "bonifico",
      }),
    ).toBe("bonifico");
  });

  it("bonifico principale solo acconti → bonifico", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 100,
        residuoCash: 0,
        haCompensazioni: false,
        tipoPagamentoPrincipale: "bonifico",
      }),
    ).toBe("bonifico");
  });

  it("contanti con acconti misti → anticipo_misto", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 30,
        residuoCash: 70,
        haCompensazioni: false,
        tipoPagamentoPrincipale: "contanti",
      }),
    ).toBe("anticipo_misto");
  });

  it("compensazioni con acconti → misto_compensato", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 50,
        residuoCash: 0,
        haCompensazioni: true,
        tipoPagamentoPrincipale: "bonifico",
      }),
    ).toBe("misto_compensato");
  });
});
