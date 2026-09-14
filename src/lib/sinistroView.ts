/**
 * Accessor "vista" per i sinistri: risolvono in modo uniforme polizza, garanzia
 * e compagnia indipendentemente dal fatto che il sinistro sia collegato a una
 * polizza CBnet (relazione `titoli`/`compagnie`) oppure sia un Sinistro Terzi
 * con una polizza esterna (relazione `polizze_terzi`).
 *
 * Usati da colonne tabella, opzioni/predicati filtro, ricerca ed export, così
 * gestionale e portale cliente restano allineati su un'unica fonte di verità.
 * Logica pura: nessuna dipendenza da Supabase o dall'ambiente.
 */
import { formatTipoSinistro } from "./tipiSinistro";

export interface PolizzaTerziLike {
  numero_polizza?: string | null;
  compagnia_nome?: string | null;
  garanzia_principale?: string | null;
  contraente?: string | null;
  broker_riferimento?: string | null;
}

export interface SinistroViewLike {
  sinistro_terzi?: boolean | null;
  ramo_sinistro?: string | null;
  tipo_sinistro?: string | null;
  tipo_sinistro_personalizzato?: string | null;
  titoli?: { id?: string | null; numero_titolo?: string | null } | null;
  compagnie?: { nome?: string | null } | null;
  polizze_terzi?: PolizzaTerziLike | null;
}

const clean = (v?: string | null): string => (typeof v === "string" ? v.trim() : "");

/** True se il sinistro è marcato come "Sinistro Terzi" (polizza non CBnet). */
export function isSinistroTerzi(s?: SinistroViewLike | null): boolean {
  return !!s?.sinistro_terzi;
}

/**
 * Numero polizza effettivo: titolo CBnet se presente, altrimenti numero della
 * polizza terzi. `null` se nessuno dei due è valorizzato.
 */
export function resolvePolizzaNumero(s?: SinistroViewLike | null): string | null {
  return clean(s?.titoli?.numero_titolo) || clean(s?.polizze_terzi?.numero_polizza) || null;
}

/** True quando la polizza mostrata proviene da `polizze_terzi` (non CBnet). */
export function isPolizzaTerzi(s?: SinistroViewLike | null): boolean {
  return !clean(s?.titoli?.numero_titolo) && !!clean(s?.polizze_terzi?.numero_polizza);
}

/**
 * Garanzia effettiva: `ramo_sinistro` (portafoglio CBnet) se presente, poi la
 * garanzia della polizza terzi, infine la label del tipo sinistro dal catalogo.
 * Ritorna stringa vuota se nulla è disponibile.
 */
export function resolveGaranzia(s?: SinistroViewLike | null): string {
  const ramo = clean(s?.ramo_sinistro);
  if (ramo) return ramo;
  const terzi = clean(s?.polizze_terzi?.garanzia_principale);
  if (terzi) return terzi;
  const tipo = formatTipoSinistro(s);
  return tipo && tipo !== "—" ? tipo : "";
}

/**
 * Compagnia effettiva: compagnia CBnet collegata oppure nome compagnia della
 * polizza terzi. `null` se nessuna delle due è valorizzata.
 */
export function resolveCompagnia(s?: SinistroViewLike | null): string | null {
  return clean(s?.compagnie?.nome) || clean(s?.polizze_terzi?.compagnia_nome) || null;
}
