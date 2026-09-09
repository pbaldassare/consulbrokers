import { describe, expect, it } from "vitest";
import { isSidebarToActive } from "@/lib/sidebarToActive";

describe("isSidebarToActive", () => {
  const archivio = "/portafoglio/documentale";
  const cbbot = "/portafoglio/documentale?tab=cb-bot";

  it("accende CB Bot solo con tab cb-bot", () => {
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=cb-bot" }, cbbot)).toBe(true);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "" }, cbbot)).toBe(false);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=cb-bot" }, archivio)).toBe(false);
  });

  it("accende Archivio Documentale quando non si è su CB Bot", () => {
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "" }, archivio)).toBe(true);
    expect(isSidebarToActive({ pathname: "/portafoglio/documentale", search: "?tab=libreria-cga" }, archivio)).toBe(true);
  });
});
