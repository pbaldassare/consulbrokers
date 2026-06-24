import { describe, it, expect } from "vitest";
import { getProvvigioneEC } from "../getProvvigioneEC";

describe("getProvvigioneEC", () => {
  it("quietanza incassata: non somma firma + quietanza (ASSISUD 4344334)", () => {
    expect(
      getProvvigioneEC({
        provvigioni_firma: 150,
        provvigioni_quietanza: 150,
        sostituisce_polizza: "madre-id",
      }),
    ).toBe(150);
  });

  it("polizza madre legacy incassata: usa provvigioni_firma", () => {
    expect(
      getProvvigioneEC({
        provvigioni_firma: 150,
        provvigioni_quietanza: 0,
        sostituisce_polizza: null,
      }),
    ).toBe(150);
  });

  it("quietanza senza sostituisce_polizza ma con quietanza > 0: preferisce quietanza", () => {
    expect(
      getProvvigioneEC({
        provvigioni_firma: 150,
        provvigioni_quietanza: 80,
      }),
    ).toBe(80);
  });

  it("quietanza con sostituisce_polizza e quietanza 0: restituisce 0", () => {
    expect(
      getProvvigioneEC({
        provvigioni_firma: 150,
        provvigioni_quietanza: 0,
        sostituisce_polizza: "madre-id",
      }),
    ).toBe(0);
  });

  it("valori null/assenti: restituisce 0", () => {
    expect(getProvvigioneEC({})).toBe(0);
    expect(getProvvigioneEC({ provvigioni_firma: null, provvigioni_quietanza: null })).toBe(0);
  });
});
