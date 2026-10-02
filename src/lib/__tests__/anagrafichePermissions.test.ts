import { describe, expect, it } from "vitest";
import { canEditProducerCommissions } from "@/lib/anagrafichePermissions";

describe("permessi provvigioni produttori", () => {
  it("consente al Responsabile Ufficio di modificare un produttore esistente", () => {
    expect(canEditProducerCommissions({
      role: "ufficio",
      isAdmin: false,
      activeTab: "corrispondente",
      editingId: "produttore-id",
    })).toBe(true);
  });

  it("non estende il permesso alle altre schede amministrative", () => {
    for (const activeTab of ["account_executive", "responsabile_sede", "specialist", "sedi"]) {
      expect(canEditProducerCommissions({
        role: "ufficio",
        isAdmin: false,
        activeTab,
        editingId: "record-id",
      })).toBe(false);
    }
  });

  it("non consente al Responsabile Ufficio di creare produttori", () => {
    expect(canEditProducerCommissions({
      role: "ufficio",
      isAdmin: false,
      activeTab: "corrispondente",
      editingId: null,
    })).toBe(false);
  });

  it("mantiene l'accesso completo dell'admin", () => {
    expect(canEditProducerCommissions({
      role: "admin",
      isAdmin: true,
      activeTab: "corrispondente",
      editingId: "produttore-id",
    })).toBe(true);
  });
});
