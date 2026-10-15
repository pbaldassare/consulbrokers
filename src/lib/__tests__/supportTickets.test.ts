import { describe, expect, it } from "vitest";
import { MAX_DOCUMENT_UPLOAD_BYTES } from "../uploadLimits";
import {
  canDeleteSupportTicket,
  canUserReplyToSupportTicket,
  escapeSupportTicketHtml,
  formatSupportTicketNumber,
  isOpenSupportTicket,
  isSupportTicketClosed,
  mergeSupportTicketAttachmentFiles,
  groupSupportTicketsByTipologia,
  SUPPORT_TICKET_TIPOLOGIA_LABEL,
  supportTicketUserLockedMessage,
  validateSupportTicketDescription,
  validateSupportTicketReply,
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

  it("raggruppa i ticket per tipologia in ordine fisso", () => {
    const grouped = groupSupportTicketsByTipologia([
      { tipologia_problema: "bug", id: "1" },
      { tipologia_problema: "richiesta_implementazione", id: "2" },
    ]);
    expect(grouped.map((g) => g.tipologia)).toEqual(["richiesta_implementazione", "bug"]);
    expect(grouped[0].tickets).toHaveLength(1);
    expect(grouped[1].tickets[0].id).toBe("1");
  });

  it("espone etichette tipologia in maiuscolo", () => {
    expect(SUPPORT_TICKET_TIPOLOGIA_LABEL.bug).toBe("BUG");
    expect(SUPPORT_TICKET_TIPOLOGIA_LABEL.richiesta_implementazione).toBe("RICHIESTA IMPLEMENTAZIONE");
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

  it("segue i turni utente / supporto", () => {
    const user = "user-1";
    const aperto = {
      stato: "aperto" as const,
      richiedenteId: user,
      userId: user,
      isAdmin: false,
    };
    expect(canUserReplyToSupportTicket({ ...aperto, utentePuoRispondere: false })).toBe(false);
    expect(canUserReplyToSupportTicket({
      stato: "preso_in_carico",
      utentePuoRispondere: true,
      richiedenteId: user,
      userId: user,
      isAdmin: false,
    })).toBe(true);
    expect(canUserReplyToSupportTicket({
      stato: "preso_in_carico",
      utentePuoRispondere: false,
      richiedenteId: user,
      userId: user,
      isAdmin: false,
    })).toBe(false);
    expect(canUserReplyToSupportTicket({
      stato: "risolto",
      utentePuoRispondere: true,
      richiedenteId: user,
      userId: user,
      isAdmin: false,
    })).toBe(false);
    expect(canUserReplyToSupportTicket({
      stato: "preso_in_carico",
      utentePuoRispondere: true,
      richiedenteId: user,
      userId: user,
      isAdmin: true,
    })).toBe(false);
    expect(isSupportTicketClosed("risolto")).toBe(true);
    expect(supportTicketUserLockedMessage("risolto")).toMatch(/risolto/i);
    expect(validateSupportTicketReply("")).toBeTruthy();
    expect(validateSupportTicketReply("Ok, fatto.")).toBeNull();
  });

  it("accoda gli allegati validi e scarta quelli troppo grandi", () => {
    const existing = new File(["a"], "già-presente.pdf");
    const ok = new File(["ok"], "ok.pdf");
    const tooBig = new File(["x"], "enorme.pdf");
    Object.defineProperty(tooBig, "size", { value: MAX_DOCUMENT_UPLOAD_BYTES + 1 });

    const { files, rejected } = mergeSupportTicketAttachmentFiles([existing], [ok, tooBig]);

    expect(files.map((file) => file.name)).toEqual(["già-presente.pdf", "ok.pdf"]);
    expect(rejected.map((file) => file.name)).toEqual(["enorme.pdf"]);
  });
});
