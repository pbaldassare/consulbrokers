import { describe, expect, it } from "vitest";
import {
  PORTALE_CBNET_URL,
  buildSinistroAperturaEmail,
  formatClienteSinistroNome,
  formatPersonaNome,
  formatSinistroAperturaData,
  formatSinistroAperturaLuogo,
  formatSinistroAperturaTipo,
  resolveUfficioSinistriRecipient,
} from "@/lib/sinistroAperturaEmail";

describe("resolveUfficioSinistriRecipient", () => {
  it("preferisce email_ufficio_sinistri", () => {
    expect(
      resolveUfficioSinistriRecipient(
        "  sinistri.sandona@consulbrokers.it  ",
        "sandona@consulbrokers.it",
      ),
    ).toEqual({
      to: "sinistri.sandona@consulbrokers.it",
      source: "email_ufficio_sinistri",
    });
  });

  it("fallback sulla mail della sede se manca quella sinistri", () => {
    expect(resolveUfficioSinistriRecipient("   ", "sandona@consulbrokers.it")).toEqual({
      to: "sandona@consulbrokers.it",
      source: "email_sede",
    });
    expect(resolveUfficioSinistriRecipient(null, "sandona@consulbrokers.it")).toEqual({
      to: "sandona@consulbrokers.it",
      source: "email_sede",
    });
  });

  it("nessuna destinazione se entrambe assenti o invalide", () => {
    expect(resolveUfficioSinistriRecipient(null, null)).toEqual({ to: null, source: "nessuna" });
    expect(resolveUfficioSinistriRecipient("non-email", "anche-questa")).toEqual({
      to: null,
      source: "nessuna",
    });
  });
});

describe("formatters apertura sinistro", () => {
  it("formatta data evento in italiano senza timezone shift", () => {
    expect(formatSinistroAperturaData("2026-03-12")).toBe("12/03/2026");
    expect(formatSinistroAperturaData("2026-03-12T00:00:00.000Z")).toBe("12/03/2026");
    expect(formatSinistroAperturaData(null)).toBeNull();
    expect(formatSinistroAperturaData("12/03/2026")).toBeNull();
  });

  it("compone il luogo da campi wizard", () => {
    expect(formatSinistroAperturaLuogo({
      luogo: "Incrocio SS14",
      indirizzo: "Via Roma 1",
      cap: "30027",
      citta: "San Donà di Piave",
      provincia: "VE",
    })).toBe("Incrocio SS14 — Via Roma 1, 30027 San Donà di Piave (VE)");
    expect(formatSinistroAperturaLuogo({ citta: "Milano", provincia: "MI" })).toBe("Milano (MI)");
    expect(formatSinistroAperturaLuogo({})).toBeNull();
  });

  it("risolve nome cliente e chi ha aperto", () => {
    expect(formatClienteSinistroNome({ ragione_sociale: "Comune di Varese" })).toBe("Comune di Varese");
    expect(formatClienteSinistroNome({ nome: "Mario", cognome: "Rossi" })).toBe("Rossi Mario");
    expect(formatPersonaNome({ nome: "Luca", cognome: "Verdi" })).toBe("Luca Verdi");
    expect(formatPersonaNome({ email: "luca@consulbrokers.it" })).toBe("luca@consulbrokers.it");
  });

  it("formatta il tipo catalogo o il testo personalizzato", () => {
    expect(formatSinistroAperturaTipo("rca_danni_a_cose", null)).toBe("rca danni a cose");
    expect(formatSinistroAperturaTipo("rca_danni_a_cose", "Urto con guard-rail")).toBe("Urto con guard-rail");
    expect(formatSinistroAperturaTipo(null, null)).toBeNull();
  });
});

describe("buildSinistroAperturaEmail", () => {
  it("costruisce oggetto e corpo semplice in italiano con descrizione e targa", () => {
    const mail = buildSinistroAperturaEmail({
      numeroSinistro: "SIN-2026-4321",
      cliente: "Comune di Varese",
      dataEvento: "12/03/2026",
      tipo: "RCA danni a cose",
      numeroPolizza: "204366651",
      targa: "AB123CD",
      luogo: "Varese — Piazza Repubblica",
      controparte: "Bianchi Luca",
      descrizione: "Tamponamento al semaforo. Nessun ferito.",
      apertoDa: "Anna Specialist",
    });

    expect(mail.subject).toBe("Nuovo sinistro aperto — SIN-2026-4321");
    expect(mail.text).toContain("È stato aperto un nuovo sinistro.");
    expect(mail.text).toContain("Numero: SIN-2026-4321");
    expect(mail.text).toContain("Cliente: Comune di Varese");
    expect(mail.text).toContain("Data evento: 12/03/2026");
    expect(mail.text).toContain("Tipo: RCA danni a cose");
    expect(mail.text).toContain("Polizza: 204366651");
    expect(mail.text).toContain("Targa: AB123CD");
    expect(mail.text).toContain("Luogo: Varese — Piazza Repubblica");
    expect(mail.text).toContain("Controparte: Bianchi Luca");
    expect(mail.text).toContain("Aperto da: Anna Specialist");
    expect(mail.text).toContain("Descrizione accadimento:");
    expect(mail.text).toContain("Tamponamento al semaforo. Nessun ferito.");
    expect(mail.text).toContain(`Apri la pratica: ${PORTALE_CBNET_URL}`);
    expect(mail.html).toContain("Tamponamento al semaforo. Nessun ferito.");
    expect(mail.html).not.toMatch(/localhost|127\.0\.0\.1|5175|8080/);
  });

  it("omette la riga targa se assente e usa — sui campi vuoti", () => {
    const mail = buildSinistroAperturaEmail({
      numeroSinistro: "SIN-2026-1",
      cliente: null,
      dataEvento: null,
      tipo: null,
      numeroPolizza: null,
      targa: null,
      luogo: null,
      controparte: "  ",
      descrizione: null,
      apertoDa: null,
      portaleUrl: "https://cbnet.it/sinistri/abc",
    });

    expect(mail.text).not.toMatch(/^Targa:/m);
    expect(mail.text).toContain("Cliente: —");
    expect(mail.text).toContain("Controparte: —");
    expect(mail.text).toContain("Descrizione accadimento:\n—");
    expect(mail.text).toContain("Apri la pratica: https://cbnet.it/sinistri/abc");
  });

  it("escapa HTML nella descrizione", () => {
    const mail = buildSinistroAperturaEmail({
      numeroSinistro: "SIN-1",
      cliente: "A & B",
      dataEvento: null,
      tipo: null,
      numeroPolizza: null,
      targa: null,
      luogo: null,
      controparte: null,
      descrizione: "<script>alert(1)</script>",
      apertoDa: null,
    });
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).not.toContain("<script>");
  });
});
