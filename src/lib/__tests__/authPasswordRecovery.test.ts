import { describe, expect, it } from "vitest";
import {
  recoveryCodeFromUrl,
  recoveryTokenHashFromUrl,
  urlLooksLikePasswordRecovery,
} from "@/lib/authPasswordRecovery";

describe("authPasswordRecovery", () => {
  it("rileva recovery da hash type=recovery", () => {
    expect(urlLooksLikePasswordRecovery("https://cbnet.it/reset-password#type=recovery&access_token=x")).toBe(true);
  });

  it("rileva recovery da query code PKCE", () => {
    expect(urlLooksLikePasswordRecovery("https://cbnet.it/reset-password?code=abc123")).toBe(true);
    expect(recoveryCodeFromUrl("https://cbnet.it/reset-password?code=abc123")).toBe("abc123");
  });

  it("rileva recovery da token_hash su cbnet.it", () => {
    const url = "https://cbnet.it/reset-password?token_hash=abc&type=recovery";
    expect(urlLooksLikePasswordRecovery(url)).toBe(true);
    expect(recoveryTokenHashFromUrl(url)).toBe("abc");
  });

  it("ignora URL login normale", () => {
    expect(urlLooksLikePasswordRecovery("https://cbnet.it/login")).toBe(false);
  });
});
