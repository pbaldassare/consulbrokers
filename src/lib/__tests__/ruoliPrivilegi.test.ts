import { describe, expect, it } from "vitest";
import { haPrivilegiResponsabileSede, ruoloConsentito } from "@/lib/ruoliPrivilegi";

describe("ruoliPrivilegi", () => {
  it("specialist (backoffice) ha privilegi responsabile sede", () => {
    expect(haPrivilegiResponsabileSede("backoffice")).toBe(true);
    expect(haPrivilegiResponsabileSede("responsabile_sede")).toBe(true);
    expect(haPrivilegiResponsabileSede("ufficio")).toBe(false);
  });

  it("RoleGuard espande resp. sede ↔ specialist", () => {
    expect(ruoloConsentito("backoffice", ["admin", "responsabile_sede"])).toBe(true);
    expect(ruoloConsentito("responsabile_sede", ["admin", "backoffice"])).toBe(true);
    expect(ruoloConsentito("ufficio", ["responsabile_sede"])).toBe(false);
  });
});
