export type UfficioSedeFormInput = {
  codice_ufficio: string;
  nome_ufficio: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
  email: string;
  email_ufficio_sinistri: string;
  telefono: string;
  attivo: boolean;
  conto_bancario_id: string | null;
};

export type UfficioSedeSavePayload = {
  codice_ufficio: string;
  nome_ufficio: string;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  email: string | null;
  email_ufficio_sinistri: string | null;
  telefono: string | null;
  attivo: boolean;
  conto_bancario_id: string | null;
};

export type UfficioSedeRecord = {
  codice_ufficio?: string | null;
  nome_ufficio?: string | null;
  indirizzo?: string | null;
  cap?: string | null;
  citta?: string | null;
  provincia?: string | null;
  email?: string | null;
  email_ufficio_sinistri?: string | null;
  telefono?: string | null;
  attivo?: boolean | null;
  conto_bancario_id?: string | null;
};

const emptyToNull = (value: string) => value.trim() || null;

export const emptyUfficioSedeForm = (): UfficioSedeFormInput => ({
  codice_ufficio: "",
  nome_ufficio: "",
  indirizzo: "",
  cap: "",
  citta: "",
  provincia: "",
  email: "",
  email_ufficio_sinistri: "",
  telefono: "",
  attivo: true,
  conto_bancario_id: null,
});

export const ufficioToFormData = (u: UfficioSedeRecord): UfficioSedeFormInput => ({
  codice_ufficio: u.codice_ufficio || "",
  nome_ufficio: u.nome_ufficio || "",
  indirizzo: u.indirizzo || "",
  cap: u.cap || "",
  citta: u.citta || "",
  provincia: u.provincia || "",
  email: u.email || "",
  email_ufficio_sinistri: u.email_ufficio_sinistri || "",
  telefono: u.telefono || "",
  attivo: u.attivo ?? true,
  conto_bancario_id: u.conto_bancario_id || null,
});

export const buildUfficioSedeSavePayload = (
  data: UfficioSedeFormInput,
): UfficioSedeSavePayload => ({
  codice_ufficio: data.codice_ufficio.trim(),
  nome_ufficio: data.nome_ufficio.trim(),
  indirizzo: emptyToNull(data.indirizzo),
  cap: emptyToNull(data.cap),
  citta: emptyToNull(data.citta),
  provincia: data.provincia.trim() ? data.provincia.trim().toUpperCase() : null,
  email: emptyToNull(data.email),
  email_ufficio_sinistri: emptyToNull(data.email_ufficio_sinistri),
  telefono: emptyToNull(data.telefono),
  attivo: data.attivo,
  conto_bancario_id: data.conto_bancario_id,
});
