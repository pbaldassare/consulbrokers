import { describe, expect, it } from "vitest";
import { passwordResetRedirectUrl } from "@/lib/publicAppUrl";

describe("passwordResetRedirectUrl", () => {
  it("usa cbnet.it se la richiesta parte da localhost", () => {
    expect(passwordResetRedirectUrl("http://localhost:5175")).toBe("https://cbnet.it/reset-password");
  });

  it("mantiene origin produzione", () => {
    expect(passwordResetRedirectUrl("https://cbnet.it")).toBe("https://cbnet.it/reset-password");
  });
});
