export type TipoTitoloRestituzione = "polizza" | "quietanza" | "regolazione";

export type RestituzioneDocRiga = {
  documentoId: string;
  nomeFile: string;
  createdAt: string | null;
  titoloId: string;
  numeroTitolo: string;
  tipoTitolo: TipoTitoloRestituzione;
  clienteId: string | null;
  clienteNome: string;
  compagniaId: string | null;
  compagniaNome: string;
  inviato: boolean;
};

export type RestituzioneGruppoCompagnia = {
  key: string;
  compagniaId: string | null;
  compagniaNome: string;
  rows: RestituzioneDocRiga[];
};

export function tipoTitoloRestituzione(t: {
  sostituisce_polizza?: unknown;
  is_regolazione?: unknown;
}): TipoTitoloRestituzione {
  if (t.is_regolazione) return "regolazione";
  if (t.sostituisce_polizza) return "quietanza";
  return "polizza";
}

export function labelTipoTitoloRestituzione(tipo: TipoTitoloRestituzione): string {
  if (tipo === "quietanza") return "Quietanza";
  if (tipo === "regolazione") return "Regolazione";
  return "Polizza";
}

export function groupRestituzioneByCompagnia(rows: RestituzioneDocRiga[]): RestituzioneGruppoCompagnia[] {
  const map = new Map<string, RestituzioneGruppoCompagnia>();
  for (const r of rows) {
    const nome = (r.compagniaNome || "").trim();
    const key = r.compagniaId || (nome ? `nome:${nome.toLowerCase()}` : "_senza");
    const existing = map.get(key);
    if (existing) {
      existing.rows.push(r);
      continue;
    }
    map.set(key, {
      key,
      compagniaId: r.compagniaId,
      compagniaNome: (r.compagniaNome || "").trim() || "Agenzia non indicata",
      rows: [r],
    });
  }
  return [...map.values()].sort((a, b) => a.compagniaNome.localeCompare(b.compagniaNome, "it"));
}

export function slugAgenziaFilename(nome: string): string {
  const slug = (nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return slug || "agenzia";
}

export function filenameDistintaRestituzione(compagniaNome: string, at: Date): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `distinta_originali_${slugAgenziaFilename(compagniaNome)}_${y}${m}${d}.pdf`;
}

export function chunkIds(ids: string[], size = 200): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export function clientiOrFilter(clienteIds: string[]): string {
  const list = clienteIds.filter(Boolean).join(",");
  return `cliente_id.in.(${list}),cliente_anagrafica_id.in.(${list})`;
}
