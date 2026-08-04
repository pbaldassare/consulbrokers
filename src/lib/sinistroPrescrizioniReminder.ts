/** Tipi condivisi prescrizioni perentorie e reminder sinistro */

import { addYears, format, parseISO } from "date-fns";

export type PrescrizioneDestinatario = "cliente" | "compagnia" | "perito" | "controparte" | "altro";

/** Destinatario obbligatorio per le prescrizioni perentorie verso l'agenzia assicurativa. */
export const PRESCRIZIONE_DESTINATARIO_AGENZIA: PrescrizioneDestinatario = "compagnia";

export const PRESCRIZIONE_BIENNALE_OGGETTO =
  "Termine di prescrizione biennale (art. 2952 c.c.)";

/** Scadenza risposta = data denuncia + 2 anni (termine prescrizione ordinario). */
export function calcScadenzaPrescrizioneBiennale(dataDenuncia: string | null | undefined): string {
  if (!dataDenuncia) return "";
  const base = parseISO(dataDenuncia);
  if (Number.isNaN(base.getTime())) return "";
  return format(addYears(base, 2), "yyyy-MM-dd");
}

export function buildPrescrizioneBiennaleAgenzia(
  dataDenuncia: string | null | undefined,
  agenziaRiferimento?: string | null,
): SinistroPrescrizioneDraft | null {
  const scadenza = calcScadenzaPrescrizioneBiennale(dataDenuncia);
  if (!scadenza) return null;
  const label = (agenziaRiferimento || "").trim() || undefined;
  return {
    destinatario_tipo: PRESCRIZIONE_DESTINATARIO_AGENZIA,
    ...(label ? { destinatario_label: label } : {}),
    oggetto: PRESCRIZIONE_BIENNALE_OGGETTO,
    corpo: "Prescrizione biennale dalla data di denuncia del sinistro.",
    data_scadenza_risposta: scadenza,
  };
}
export type PrescrizioneStato = "bozza" | "inviata" | "risposta_ricevuta" | "scaduta";

export type SinistroPrescrizioneRow = {
  id: string;
  sinistro_id: string;
  creato_da: string;
  destinatario_tipo: PrescrizioneDestinatario;
  destinatario_label: string | null;
  oggetto: string;
  corpo: string | null;
  data_invio: string | null;
  data_scadenza_risposta: string;
  stato: PrescrizioneStato;
  canale: string | null;
  note: string | null;
  created_at: string;
};

export type SinistroPrescrizioneDraft = {
  destinatario_tipo: PrescrizioneDestinatario;
  destinatario_label?: string;
  oggetto: string;
  corpo?: string;
  data_scadenza_risposta: string;
  canale?: string;
  note?: string;
};

export type SinistroReminderCategoria =
  | "documenti"
  | "follow_up"
  | "perizia"
  | "contatto_cliente"
  | "altro";

export type SinistroReminderStato = "attivo" | "completato" | "annullato";

export type SinistroReminderRow = {
  id: string;
  sinistro_id: string;
  user_id: string;
  creato_da: string | null;
  assegnato_a: string | null;
  titolo_id: string | null;
  cliente_id: string | null;
  testo: string;
  categoria: SinistroReminderCategoria;
  data_scadenza: string;
  data_promemoria: string | null;
  stato: SinistroReminderStato;
  letto: boolean;
  completato: boolean;
  popup_mostrato_at: string | null;
  created_at: string;
  updated_at?: string;
  sinistri?: {
    id: string;
    numero_sinistro: string | null;
    stato: string | null;
    ufficio_id: string | null;
    compagnia_id: string | null;
    clienti?: { cognome?: string; nome?: string; ragione_sociale?: string; tipo_cliente?: string } | null;
    titoli?: { numero_titolo?: string | null; ramo_id?: string | null; rami?: { descrizione?: string } | null } | null;
    profiles?: { nome?: string; cognome?: string } | null;
  } | null;
  assegnato?: { nome?: string; cognome?: string } | null;
};

export type SinistroReminderDraft = {
  testo: string;
  data_scadenza: string;
  categoria?: SinistroReminderCategoria;
  assegnato_a?: string;
};

export const REMINDER_CATEGORIA_LABEL: Record<SinistroReminderCategoria, string> = {
  documenti: "Documenti",
  follow_up: "Follow-up",
  perizia: "Perizia",
  contatto_cliente: "Contatto cliente",
  altro: "Altro",
};

export const REMINDER_CATEGORIA_OPTIONS = (
  Object.entries(REMINDER_CATEGORIA_LABEL) as [SinistroReminderCategoria, string][]
).map(([value, label]) => ({ value, label }));

export const REMINDER_STATO_LABEL: Record<SinistroReminderStato, string> = {
  attivo: "Attivo",
  completato: "Completato",
  annullato: "Annullato",
};

export const REMINDER_STATO_CLASS: Record<SinistroReminderStato, string> = {
  attivo: "bg-blue-100 text-blue-800",
  completato: "bg-green-100 text-green-800",
  annullato: "bg-muted text-muted-foreground",
};

export const PRESCRIZIONE_STATO_LABEL: Record<PrescrizioneStato, string> = {
  bozza: "Bozza",
  inviata: "Inviata",
  risposta_ricevuta: "Risposta ricevuta",
  scaduta: "Scaduta",
};

export const PRESCRIZIONE_STATO_CLASS: Record<PrescrizioneStato, string> = {
  bozza: "bg-muted text-muted-foreground",
  inviata: "bg-blue-100 text-blue-800",
  risposta_ricevuta: "bg-green-100 text-green-800",
  scaduta: "bg-red-100 text-red-800",
};

export const DESTINATARIO_LABEL: Record<PrescrizioneDestinatario, string> = {
  cliente: "Cliente",
  /** Valore DB storico `compagnia`: in UI è l'agenzia di riferimento della polizza. */
  compagnia: "Agenzia di riferimento",
  perito: "Perito",
  controparte: "Controparte",
  altro: "Altro",
};
