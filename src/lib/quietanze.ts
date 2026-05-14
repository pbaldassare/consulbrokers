// Helpers per distinguere Polizza (madre) vs Quietanze successive (rate).
// Convenzione: titoli con stesso numero_titolo formano una "catena polizza".
// La madre è il titolo con sostituisce_polizza == null.
// Le quietanze sono i titoli con sostituisce_polizza valorizzato.

export type TitoloLike = {
  id: string;
  numero_titolo?: string | null;
  sostituisce_polizza?: string | null;
  garanzia_da?: string | null;
  garanzia_a?: string | null;
  created_at?: string | null;
};

export function isQuietanza(t: TitoloLike): boolean {
  return !!t.sostituisce_polizza;
}

export type CatenaPolizza<T extends TitoloLike> = {
  numero: string;
  madre: T | null;
  rate: T[]; // ordinate cronologicamente per garanzia_da/created_at
  all: T[];  // madre + rate, stesso ordine
};

export function groupTitoliByPolizza<T extends TitoloLike>(titoli: T[]): CatenaPolizza<T>[] {
  const byNumero = new Map<string, T[]>();
  for (const t of titoli) {
    const k = (t.numero_titolo || `__id_${t.id}`).trim();
    const arr = byNumero.get(k) || [];
    arr.push(t);
    byNumero.set(k, arr);
  }
  const out: CatenaPolizza<T>[] = [];
  for (const [numero, arr] of byNumero.entries()) {
    const sorted = [...arr].sort((a, b) => {
      const da = a.garanzia_da || a.created_at || "";
      const db = b.garanzia_da || b.created_at || "";
      return da.localeCompare(db);
    });
    const madre = sorted.find((x) => !x.sostituisce_polizza) || null;
    const rate = sorted.filter((x) => x.sostituisce_polizza);
    out.push({ numero, madre, rate, all: sorted });
  }
  // ordina catene per ultima rata desc (più recente in alto)
  out.sort((a, b) => {
    const la = a.all[a.all.length - 1]?.garanzia_da || a.all[a.all.length - 1]?.created_at || "";
    const lb = b.all[b.all.length - 1]?.garanzia_da || b.all[b.all.length - 1]?.created_at || "";
    return lb.localeCompare(la);
  });
  return out;
}

/** Ritorna l'indice 1-based del titolo nella catena (1 = madre). 0 se non trovato. */
export function getRataIndex<T extends TitoloLike>(titolo: T, catena: CatenaPolizza<T>): number {
  const idx = catena.all.findIndex((x) => x.id === titolo.id);
  return idx < 0 ? 0 : idx + 1;
}

export function tipoLabel<T extends TitoloLike>(titolo: T, catena?: CatenaPolizza<T>): string {
  if (!isQuietanza(titolo)) return "Polizza";
  if (catena) {
    const n = getRataIndex(titolo, catena);
    return n > 1 ? `Rata ${n}` : "Quietanza";
  }
  return "Quietanza";
}
