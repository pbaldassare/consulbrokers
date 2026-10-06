import { describe, expect, it } from "vitest";
import {
  canDeleteSupportTicket,
  escapeSupportTicketHtml,
  formatSupportTicketNumber,
  isOpenSupportTicket,
  validateSupportTicketDescription,
} from "../supportTickets";

describe("supportTickets", () => {
  it("consente l'eliminazione solo ad admin@consul.it", () => {
    expect(canDeleteSupportTicket("admin@consul.it")).toBe(true);
    expect(canDeleteSupportTicket(" Admin@Consul.IT ")).toBe(true);
    expect(canDeleteSupportTicket("sandona@consulbrokers.it")).toBe(false);
    expect(canDeleteSupportTicket("admin@consul.it.evil.com")).toBe(false);
    expect(canDeleteSupportTicket(null)).toBe(false);
  });

  it("formatta il numero leggibile del ticket", () => {
    expect(formatSupportTicketNumber(42)).toBe("TCK-000042");
  });

  it("separa i ticket operativi dallo storico", () => {
    expect(isOpenSupportTicket("aperto")).toBe(true);
    expect(isOpenSupportTicket("preso_in_carico")).toBe(true);
    expect(isOpenSupportTicket("risolto")).toBe(false);
  });

  it("richiede una descrizione sufficientemente dettagliata", () => {
    expect(validateSupportTicketDescription("Problema breve")).toBeTruthy();
    expect(validateSupportTicketDescription("La polizza 123 non compare nella scheda cliente.")).toBeNull();
  });

  it("protegge i contenuti inseriti nelle email HTML", () => {
    expect(escapeSupportTicketHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });
});
