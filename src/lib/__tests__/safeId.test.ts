import { afterEach, describe, expect, it, vi } from "vitest";
import { safeId } from "@/lib/safeId";

describe("safeId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("usa randomUUID quando disponibile", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-2222-3333-4444-555555555555" });
    expect(safeId()).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("non crasha se randomUUID manca o lancia (HTTP su IP)", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        throw new Error("Secure random unavailable");
      },
    });
    const id = safeId();
    expect(id.startsWith("id-")).toBe(true);
    expect(id.length).toBeGreaterThan(8);
  });
});
