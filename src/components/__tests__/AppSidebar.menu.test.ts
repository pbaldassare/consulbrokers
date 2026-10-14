import { describe, expect, it } from "vitest";
import { getSidebarGroupChildren } from "@/components/AppSidebar";

describe("sidebar menu — Clienti sotto Anagrafiche", () => {
  it("mette Clienti in Anagrafiche e non in Portafoglio", () => {
    const anagrafiche = getSidebarGroupChildren("Anagrafiche");
    const portafoglio = getSidebarGroupChildren("Portafoglio");

    expect(anagrafiche[0]).toEqual({ label: "Clienti", path: "/clienti" });
    expect(anagrafiche.some((c) => c.path === "/clienti")).toBe(true);
    expect(portafoglio.some((c) => c.path === "/clienti" || c.label === "Clienti")).toBe(false);
  });
});
