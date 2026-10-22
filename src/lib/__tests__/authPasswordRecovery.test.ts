import { describe, expect, it } from "vitest";
import { recoveryCodeFromUrl, urlLooksLikePasswordRecovery } from "@/lib/authPasswordRecovery";

describe("authPasswordRecovery", () => {
  it("rileva recovery da hash type=recovery", () => {
    expect(urlLooksLikePasswordRecovery("https://cbnet.it/reset-password#type=recovery&access_token=x")).toBe(true);
  });

  it("rileva recovery da query code PKCE", () => {
    expect(urlLooksLikePasswordRecovery("https://cbnet.it/reset-password?code=abc123")).toBe(true);
    expect(recoveryCodeFromUrl("https://cbnet.it/reset-password?code=abc123")).toBe("abc123");
  });

  it("ignora URL login normale", () => {
    expect(urlLooksLikePasswordRecovery("https://cbnet.it/login")).toBe(false);
  });
});
