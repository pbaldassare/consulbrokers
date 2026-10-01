import { supabase } from "@/integrations/supabase/client";
import { isClienteEnte, type ClienteCigSnippet } from "@/lib/cigEnte";
import { isGeneratedCigTemporaneo, isValidCig, normalizeCig } from "@/lib/validateCig";

type CigFonte = { cig: string | null | undefined; temporaneo?: boolean | null };

export type CigEcResolved = {
  /** CIG definitivo da stampare (solo soggetti obbligati). */
  cig: string | null;
  /** Cliente ente: CIG obbligatorio su E/C agenzia. */
  obbligatorio: boolean;
  /** Obbligatorio ma assente o solo temporaneo/malformato. */
  mancante: boolean;
};

const NESSUN_CIG: CigEcResolved = { cig: null, obbligatorio: false, mancante: false };

/**
 * CIG per stampa E/C agenzia: titolo → polizza madre → anagrafica cliente.
 * Stampato solo per clienti ente e solo se definitivo (10 alfanumerici).
 */
export function resolveCigEc(params: {
  titolo: CigFonte;
  madre?: CigFonte | null;
  cliente?: (ClienteCigSnippet & { codice_cig?: string | null; cig_temporaneo?: boolean | null }) | null;
}): CigEcResolved {
  const obbligatorio = isClienteEnte(params.cliente);
  if (!obbligatorio) return NESSUN_CIG;
  const fonti: CigFonte[] = [
    params.titolo,
    params.madre || { cig: null },
    { cig: params.cliente?.codice_cig, temporaneo: params.cliente?.cig_temporaneo },
  ];
  for (const f of fonti) {
    const v = normalizeCig(f.cig || "");
    if (!v || f.temporaneo || isGeneratedCigTemporaneo(v) || !isValidCig(v)) continue;
    return { cig: v, obbligatorio, mancante: false };
  }
  return { cig: null, obbligatorio, mancante: true };
}

export function formatCigStampa(cig: string | null | undefined): string {
  return cig ? `CIG ${cig}` : "";
}

export type TitoloCigInput = {
  id: string;
  numero_titolo?: string | null;
  compagnia_id?: string | null;
  cliente_anagrafica_id?: string | null;
  sostituisce_polizza?: string | null;
  cig_rif?: string | null;
  cig_temporaneo?: boolean | null;
};

export function numeroPolizzaMadre(t: Pick<TitoloCigInput, "numero_titolo" | "sostituisce_polizza">): string {
  const base = (t.sostituisce_polizza || t.numero_titolo || "").trim();
  return base.split("/")[0].trim();
}

const CHUNK = 200;

function chunks<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK));
  return out;
}

/** Risolve il CIG da stampare per ogni titolo (map per id). */
export async function fetchCigEcByTitolo(titoli: TitoloCigInput[]): Promise<Map<string, CigEcResolved>> {
  const out = new Map<string, CigEcResolved>();
  if (!titoli.length) return out;

  const clienteIds = [...new Set(titoli.map((t) => t.cliente_anagrafica_id).filter(Boolean) as string[])];
  const clienti = new Map<string, ClienteCigSnippet & { codice_cig?: string | null; cig_temporaneo?: boolean | null }>();
  for (const ids of chunks(clienteIds)) {
    const { data, error } = await supabase
      .from("clienti")
      .select("id, tipo_cliente, codice_cig, cig_temporaneo, gruppi_finanziari(tipo_soggetto)")
      .in("id", ids);
    if (error) throw error;
    for (const c of data || []) clienti.set(c.id, c);
  }

  const daRisolvere = titoli.filter((t) => {
    const cli = t.cliente_anagrafica_id ? clienti.get(t.cliente_anagrafica_id) : null;
    return isClienteEnte(cli);
  });
  const numeriMadre = [...new Set(daRisolvere.map(numeroPolizzaMadre).filter(Boolean))];
  const madri = new Map<string, CigFonte>();
  for (const nums of chunks(numeriMadre)) {
    const { data, error } = await supabase
      .from("titoli")
      .select("numero_titolo, compagnia_id, cig_rif, cig_temporaneo")
      .in("numero_titolo", nums)
      .is("sostituisce_polizza", null)
      .not("cig_rif", "is", null);
    if (error) throw error;
    for (const m of data || []) {
      const fonte = { cig: m.cig_rif, temporaneo: m.cig_temporaneo };
      madri.set(`${m.numero_titolo}|${m.compagnia_id || ""}`, fonte);
      if (!madri.has(`${m.numero_titolo}|`)) madri.set(`${m.numero_titolo}|`, fonte);
    }
  }

  for (const t of titoli) {
    const cli = t.cliente_anagrafica_id ? clienti.get(t.cliente_anagrafica_id) : null;
    const num = numeroPolizzaMadre(t);
    const madre = madri.get(`${num}|${t.compagnia_id || ""}`) || madri.get(`${num}|`) || null;
    out.set(t.id, resolveCigEc({ titolo: { cig: t.cig_rif, temporaneo: t.cig_temporaneo }, madre, cliente: cli }));
  }
  return out;
}

/** Aggiunge `_cigEc` a ogni titolo (per stampe E/C agenzia). */
export async function conCigEc<T extends TitoloCigInput>(rows: T[]): Promise<(T & { _cigEc: CigEcResolved })[]> {
  const map = await fetchCigEcByTitolo(rows);
  return rows.map((r) => ({ ...r, _cigEc: map.get(r.id) || NESSUN_CIG }));
}
