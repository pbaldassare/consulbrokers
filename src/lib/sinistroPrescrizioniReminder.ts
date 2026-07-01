/** Tipi condivisi prescrizioni perentorie e reminder sinistro */

export type PrescrizioneDestinatario = "cliente" | "compagnia" | "perito" | "controparte" | "altro";
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

export type SinistroReminderRow = {
  id: string;
  sinistro_id: string;
  user_id: string;
  testo: string;
  data_promemoria: string | null;
  completato: boolean;
  created_at: string;
};

export type SinistroReminderDraft = {
  testo: string;
  data_promemoria?: string;
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
  compagnia: "Compagnia",
  perito: "Perito",
  controparte: "Controparte",
  altro: "Altro",
};
