import { describe, expect, it } from "vitest";
import {
  escapeSupportTicketHtml,
  formatSupportTicketNumber,
  isOpenSupportTicket,
  validateSupportTicketDescription,
} from "../supportTickets";

describe("supportTickets", () => {
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
