/** Mail di notifica apertura sinistro all'ufficio sinistri della sede. Helper puro, testabile. */

export const PORTALE_CBNET_URL = "https://cbnet.it";

export type UfficioSinistriRecipientSource =
  | "email_ufficio_sinistri"
  | "email_sede"
  | "nessuna";

export type UfficioSinistriRecipient = {
  to: string | null;
  source: UfficioSinistriRecipientSource;
};

export type SinistroAperturaEmailInput = {
  numeroSinistro: string;
  cliente: string | null;
  dataEvento: string | null;
  tipo: string | null;
  numeroPolizza: string | null;
  targa: string | null;
  luogo: string | null;
  controparte: string | null;
  descrizione: string | null;
  apertoDa: string | null;
  portaleUrl?: string;
};

export type SinistroAperturaEmailContent = {
  subject: string;
  text: string;
  html: string;
};

const dash = (value: string | null | undefined) => {
  const t = value?.trim();
  return t ? t : "—";
};

export function normalizeEmail(value: string | null | undefined): string | null {
  const t = value?.trim();
  if (!t) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t;
}

/** Destinatario: mail ufficio sinistri, altrimenti mail della sede. */
export function resolveUfficioSinistriRecipient(
  emailUfficioSinistri?: string | null,
  emailSede?: string | null,
): UfficioSinistriRecipient {
  const sinistri = normalizeEmail(emailUfficioSinistri);
  if (sinistri) return { to: sinistri, source: "email_ufficio_sinistri" };
  const sede = normalizeEmail(emailSede);
  if (sede) return { to: sede, source: "email_sede" };
  return { to: null, source: "nessuna" };
}

export function formatSinistroAperturaData(iso: string | null | undefined): string | null {
  if (iso == null || iso === "") return null;
  const s = String(iso).trim().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatSinistroAperturaLuogo(parts: {
  luogo?: string | null;
  indirizzo?: string | null;
  citta?: string | null;
  cap?: string | null;
  provincia?: string | null;
}): string | null {
  const luogo = parts.luogo?.trim();
  const indirizzo = parts.indirizzo?.trim();
  const citta = parts.citta?.trim();
  const cap = parts.cap?.trim();
  const provincia = parts.provincia?.trim();
  const city = [cap, citta].filter(Boolean).join(" ");
  const tail = [city, provincia ? `(${provincia})` : ""].filter(Boolean).join(" ");
  const composed = [indirizzo, tail].filter(Boolean).join(", ");
  if (luogo && composed && !luogo.toLowerCase().includes(composed.toLowerCase())) {
    return `${luogo} — ${composed}`;
  }
  return luogo || composed || null;
}

export function formatClienteSinistroNome(c: {
  ragione_sociale?: string | null;
  nome?: string | null;
  cognome?: string | null;
} | null | undefined): string | null {
  if (!c) return null;
  const rs = c.ragione_sociale?.trim();
  if (rs) return rs;
  const persona = `${c.cognome || ""} ${c.nome || ""}`.trim();
  return persona || null;
}

export function formatPersonaNome(p: {
  nome?: string | null;
  cognome?: string | null;
  email?: string | null;
} | null | undefined): string | null {
  if (!p) return null;
  const persona = `${p.nome || ""} ${p.cognome || ""}`.trim();
  if (persona) return persona;
  return p.email?.trim() || null;
}

/** Tipo catalogo (underscore → spazi) o testo personalizzato dal wizard. */
export function formatSinistroAperturaTipo(
  tipo?: string | null,
  personalizzato?: string | null,
): string | null {
  const custom = personalizzato?.trim();
  if (custom) return custom;
  const t = tipo?.trim();
  if (!t) return null;
  return t.replace(/_/g, " ");
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSinistroAperturaEmail(
  input: SinistroAperturaEmailInput,
): SinistroAperturaEmailContent {
  const numero = input.numeroSinistro.trim() || "—";
  const subject = `Nuovo sinistro aperto — ${numero}`;
  const portale = (input.portaleUrl || PORTALE_CBNET_URL).trim() || PORTALE_CBNET_URL;
  const descrizione = input.descrizione?.trim() || "—";

  const lines = [
    "È stato aperto un nuovo sinistro.",
    "",
    `Numero: ${numero}`,
    `Cliente: ${dash(input.cliente)}`,
    `Data evento: ${dash(input.dataEvento)}`,
    `Tipo: ${dash(input.tipo)}`,
    `Polizza: ${dash(input.numeroPolizza)}`,
  ];
  if (input.targa?.trim()) {
    lines.push(`Targa: ${input.targa.trim()}`);
  }
  lines.push(
    `Luogo: ${dash(input.luogo)}`,
    `Controparte: ${dash(input.controparte)}`,
    `Aperto da: ${dash(input.apertoDa)}`,
    "",
    "Descrizione accadimento:",
    descrizione,
    "",
    `Apri la pratica: ${portale}`,
  );

  const text = lines.join("\n");
  const html = text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");

  return { subject, text, html };
}
