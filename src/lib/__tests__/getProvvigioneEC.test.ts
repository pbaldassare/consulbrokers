import { describe, it, expect } from "vitest";
import { getProvvigioneEC } from "../getProvvigioneEC";

describe("getProvvigioneEC", () => {
  it("quietanza/rata: usa provvigioni_quietanza", () => {
    expect(
      getProvvigioneEC({
        sostituisce_polizza: "madre-id",
        provvigioni_firma: 150,
        provvigioni_quietanza: 150,
      }),
    ).toBe(150);
  });

  it("quietanza/rata: zero esplicito resta zero", () => {
    expect(
      getProvvigioneEC({
        sostituisce_polizza: "madre-id",
        provvigioni_firma: 23.57,
        provvigioni_quietanza: 0,
      }),
    ).toBe(0);
  });

  it("polizza madre: zero firma scritto a mano non viene sovrascritto dalla quietanza", () => {
    expect(
      getProvvigioneEC({
        provvigioni_firma: 0,
        provvigioni_quietanza: 23.57,
      }),
    ).toBe(0);
  });

  it("polizza madre: firma valorizzata vince sulla quietanza", () => {
    expect(
      getProvvigioneEC({
        provvigioni_firma: 100,
        provvigioni_quietanza: 23.57,
      }),
    ).toBe(100);
  });

  it("polizza madre legacy: firma null → fallback su quietanza", () => {
    expect(
      getProvvigioneEC({
        provvigioni_firma: null,
        provvigioni_quietanza: 23.57,
      }),
    ).toBe(23.57);
  });

  it("polizza madre legacy: firma undefined → fallback su quietanza", () => {
    expect(getProvvigioneEC({ provvigioni_quietanza: 23.57 })).toBe(23.57);
  });

  it("entrambi null → 0", () => {
    expect(getProvvigioneEC({})).toBe(0);
  });
});
