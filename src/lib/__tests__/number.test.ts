import { describe, expect, it } from "vitest";
import { formatFixed2 } from "@/lib/number";

describe("formatFixed2", () => {
  it("tronca i float lunghi a due decimali", () => {
    expect(formatFixed2(23.00054503661224)).toBe("23.00");
    expect(formatFixed2("23.00054503661224")).toBe("23.00");
    expect(formatFixed2("23,456")).toBe("23.46");
  });

  it("accetta vuoto e non numerico", () => {
    expect(formatFixed2("")).toBe("");
    expect(formatFixed2(null)).toBe("");
    expect(formatFixed2("abc")).toBe("");
  });
});
