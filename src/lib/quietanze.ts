// Helpers per distinguere Polizza (prima rata incassabile) vs Quietanze successive.
// Convenzione: titoli con stesso numero_titolo formano una "catena polizza".
// La polizza è il titolo con sostituisce_polizza == null.
// Le quietanze sono i titoli con sostituisce_polizza valorizzato.

export type TitoloLike = {
  id?: string;
  numero_titolo?: string | null;
  sostituisce_polizza?: string | null;
  garanzia_da?: string | null;
  garanzia_a?: string | null;
  created_at?: string | null;
  is_appendice_modifica?: boolean | null;
  is_proroga?: boolean | null;
  is_regolazione?: boolean | null;
  appendice_modifica_polizza_madre_id?: string | null;
  proroga_polizza_madre_id?: string | null;
  regolazione_quietanza_id?: string | null;
};

export type TitoloCoperturaLike = TitoloLike & {
  data_copertura?: string | null;
  conferimento_gestito?: boolean | null;
  data_messa_cassa?: string | null;
};

export function isQuietanza(t: TitoloLike): boolean {
  // Le appendici (AM/PR/RG) sono titoli da incassare ma NON sono quietanze.
  return !!t.sostituisce_polizza && !isAppendice(t);
}

/** Titolo derivato da appendice (modifica / proroga / regolazione). */
export function isAppendice(t: TitoloLike): boolean {
  return !!(t.is_appendice_modifica || t.is_proroga || t.is_regolazione);
}

/** Polizza o quietanza a cui è agganciata l'appendice (FK su titoli). */
export function appendiceAncoraId(t: TitoloLike): string | null {
  return t.appendice_modifica_polizza_madre_id
    || t.proroga_polizza_madre_id
    || t.regolazione_quietanza_id
    || null;
}

function chainKeyNonAppendice(t: TitoloLike): string {
  return (t.numero_titolo || "").trim() || (t.id ? `__id_${t.id}` : "");
}

function chainKeyAppendice(
  t: TitoloLike,
  byId: Map<string, TitoloLike>,
  override?: string,
): string {
  if (override) return override;
  const ancoraId = appendiceAncoraId(t);
  if (ancoraId) {
    const ancora = byId.get(ancoraId);
    if (ancora) {
      if (isAppendice(ancora)) {
        const nestedId = appendiceAncoraId(ancora);
        const nested = nestedId ? byId.get(nestedId) : undefined;
        if (nested) return chainKeyNonAppendice(nested);
      }
      return chainKeyNonAppendice(ancora);
    }
  }
  return baseNumeroPolizza(t.numero_titolo) || (t.id ? `__id_${t.id}` : "");
}

/**
 * Polizza (prima rata / titolo originario): senza sostituisce_polizza e senza flag appendice.
 * La polizza È incassabile (stesso periodo della prima rata).
 * Se `sostituisce_polizza` non è nel payload (undefined), non si assume polizza.
 */
export function isPolizzaMadre(t: TitoloLike): boolean {
  if (isAppendice(t)) return false;
  if (t.sostituisce_polizza === undefined) return false;
  return !t.sostituisce_polizza;
}

/**
 * True se il titolo può avere data_copertura / messa a cassa.
 * Polizza, quietanza e appendice sono tutte incassabili.
 */
export function canHaveDataCopertura(_t: TitoloLike): boolean {
  return true;
}

/**
 * Copertura più recente nella catena (MAX data ISO su polizza + quietanze).
 */
export function dataCoperturaUltimaQuietanza<T extends TitoloCoperturaLike>(
  rate: T[],
): string | null {
  let max: string | null = null;
  for (const r of rate) {
    const d = r.data_copertura;
    if (d && (!max || d > max)) max = d;
  }
  return max;
}

/** Quietanza che porta la copertura più recente (per stile "in copertura garantita"). */
export function quietanzaUltimaCopertura<T extends TitoloCoperturaLike>(
  rate: T[],
): T | null {
  const max = dataCoperturaUltimaQuietanza(rate);
  if (!max) return null;
  for (let i = rate.length - 1; i >= 0; i--) {
    if (rate[i].data_copertura === max) return rate[i];
  }
  return null;
}

/** Etichetta del sottotipo appendice, o null se non è un'appendice. */
export function appendiceTipoLabel(t: TitoloLike): string | null {
  if (t.is_appendice_modifica) return "Modifica";
  if (t.is_proroga) return "Proroga";
  if (t.is_regolazione) return "Regolazione";
  return null;
}

/**
 * Numero polizza "base": rimuove il suffisso appendice (/AM1, /PR2, /RG3) così
 * le appendici vengono raggruppate sotto la polizza madre.
 */
export function baseNumeroPolizza(numero: string | null | undefined): string {
  return (numero || "").trim().replace(/\/(AM|PR|RG)\d+$/i, "");
}

export type CatenaPolizza<T extends TitoloLike> = {
  numero: string;
  madre: T | null;
  rate: T[]; // quietanze, ordinate cronologicamente per garanzia_da/created_at
  appendici: T[]; // appendici AM/PR/RG collegate alla madre
  all: T[];  // madre + rate + appendici, stesso ordine
};

/**
 * Raggruppa titoli in catene polizza.
 * @param appendiceBaseOverrides mappa titolo-appendice id → numero base polizza
 *   (da link `appendici_polizza` quando il numero appendice non collassa sulla madre).
 */
function sortCatenaItems<T extends TitoloLike>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const da = a.garanzia_da || a.created_at || "";
    const db = b.garanzia_da || b.created_at || "";
    return da.localeCompare(db);
  });
}

function toCatena<T extends TitoloLike>(numero: string, arr: T[]): CatenaPolizza<T> {
  const sorted = sortCatenaItems(arr);
  const madre = sorted.find((x) => !x.sostituisce_polizza && !isAppendice(x)) || null;
  const rate = sorted.filter((x) => x.sostituisce_polizza && !isAppendice(x));
  const appendici = sorted.filter((x) => isAppendice(x));
  return { numero, madre, rate, appendici, all: sorted };
}

export function groupTitoliByPolizza<T extends TitoloLike>(
  titoli: T[],
  appendiceBaseOverrides?: Map<string, string>,
): CatenaPolizza<T>[] {
  const byId = new Map<string, T>();
  for (const t of titoli) {
    if (t.id) byId.set(t.id, t);
  }

  const byNumero = new Map<string, T[]>();
  for (const t of titoli) {
    // Appendice: prima FK madre/quietanza, poi override appendici_polizza,
    // poi suffisso /AM /PR /RG. Mai una catena a sé se esiste un'ancora.
    const override = t.id ? appendiceBaseOverrides?.get(t.id) : undefined;
    const k = (isAppendice(t)
      ? chainKeyAppendice(t, byId, override)
      : chainKeyNonAppendice(t)) || `__id_${t.id}`;
    const arr = byNumero.get(k) || [];
    arr.push(t);
    byNumero.set(k, arr);
  }

  const out: CatenaPolizza<T>[] = [];
  const orphans: T[] = [];
  for (const [numero, arr] of byNumero.entries()) {
    const catena = toCatena(numero, arr);
    const soloAppendici = !catena.madre && catena.rate.length === 0 && catena.appendici.length > 0;
    if (soloAppendici) {
      orphans.push(...catena.appendici);
      continue;
    }
    out.push(catena);
  }

  // Orfane residue: prova ad attaccare per FK a una catena già emessa.
  for (const app of orphans) {
    const ancoraId = appendiceAncoraId(app);
    const host = ancoraId
      ? out.find((c) => c.all.some((x) => x.id === ancoraId) || c.madre?.id === ancoraId)
      : undefined;
    if (host) {
      host.appendici.push(app);
      host.all = sortCatenaItems([...host.all, app]);
      continue;
    }
    // Nessuna madre/quietanza in elenco: non creare una riga-polizza finta.
  }
  // ordina catene per ultima rata desc (più recente in alto)
  out.sort((a, b) => {
    const la = a.all[a.all.length - 1]?.garanzia_da || a.all[a.all.length - 1]?.created_at || "";
    const lb = b.all[b.all.length - 1]?.garanzia_da || b.all[b.all.length - 1]?.created_at || "";
    return lb.localeCompare(la);
  });
  return out;
}

/** Numero di quietanze nella catena (esclusa la madre). */
export function getTotQuietanze<T extends TitoloLike>(catena: CatenaPolizza<T>): number {
  return catena.rate.length;
}

/**
 * Indice 1-based della quietanza tra le rate (1..N).
 * Ritorna 0 se il titolo è la polizza madre o non è nella catena.
 */
export function getQuietanzaRataIndex<T extends TitoloLike>(titolo: T, catena: CatenaPolizza<T>): number {
  if (!isQuietanza(titolo)) return 0;
  const idx = catena.rate.findIndex((x) => x.id === titolo.id);
  return idx < 0 ? 0 : idx + 1;
}

/** @deprecated Usare getQuietanzaRataIndex — stessa semantica (0 = madre, 1..N = quietanze). */
export function getRataIndex<T extends TitoloLike>(titolo: T, catena: CatenaPolizza<T>): number {
  return getQuietanzaRataIndex(titolo, catena);
}

export function tipoLabel<T extends TitoloLike>(titolo: T, catena?: CatenaPolizza<T>): string {
  if (isAppendice(titolo)) {
    const sub = appendiceTipoLabel(titolo);
    return sub ? `Appendice ${sub}` : "Appendice";
  }
  if (!isQuietanza(titolo)) return "Polizza";
  if (catena) {
    const n = getQuietanzaRataIndex(titolo, catena);
    const tot = getTotQuietanze(catena);
    return tot > 1 ? `Rata ${n}` : "Quietanza";
  }
  return "Quietanza";
}
