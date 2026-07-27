/** Sessione soft area consultazione (nessuna auth Supabase). */

export const CONSULTAZIONE_DISCLAIMER_VERSION = "2026-07-27";
export const CONSULTAZIONE_EMAIL_DOMAIN = "@consulbrokers.it";
export const CONSULTAZIONE_STORAGE_KEY = "cbnet_consultazione_session_v1";

export type ConsultazioneSession = {
  email: string;
  acceptedAt: string;
  disclaimerVersion: string;
};

export function normalizeConsultazioneEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isConsultazioneEmailAllowed(email: string): boolean {
  const e = normalizeConsultazioneEmail(email);
  return e.endsWith(CONSULTAZIONE_EMAIL_DOMAIN) && e.length > CONSULTAZIONE_EMAIL_DOMAIN.length;
}

export function readConsultazioneSession(): ConsultazioneSession | null {
  try {
    const raw = localStorage.getItem(CONSULTAZIONE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsultazioneSession;
    if (!parsed?.email || !parsed?.acceptedAt || !parsed?.disclaimerVersion) return null;
    if (!isConsultazioneEmailAllowed(parsed.email)) return null;
    if (parsed.disclaimerVersion !== CONSULTAZIONE_DISCLAIMER_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeConsultazioneSession(email: string): ConsultazioneSession {
  const session: ConsultazioneSession = {
    email: normalizeConsultazioneEmail(email),
    acceptedAt: new Date().toISOString(),
    disclaimerVersion: CONSULTAZIONE_DISCLAIMER_VERSION,
  };
  localStorage.setItem(CONSULTAZIONE_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearConsultazioneSession(): void {
  localStorage.removeItem(CONSULTAZIONE_STORAGE_KEY);
}

export const CONSULTAZIONE_DISCLAIMER_TEXT = `
Dichiaro di essere un dipendente di Consulbrokers e di accedere a quest'area esclusivamente per finalità lavorative.

Sono consapevole che:
• i dati consultati e le ricerche effettuate vengono salvati e possono essere visualizzati da altri soggetti autorizzati all'interno di Consulbrokers;
• l'uso di questo strumento è riservato all'attività professionale e non è consentito per scopi personali o esterni all'azienda;
• l'accesso avviene mediante email aziendale e non sostituisce le autenticazioni del gestionale.

Accettando, confermo di aver letto e compreso queste condizioni.
`.trim();
