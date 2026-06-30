import { supabase } from "@/integrations/supabase/client";

const round2 = (n: number) => Math.round(n * 100) / 100;

const CAUSALE_STOP_RE =
  /\s+(CIG|RINNOVO|POLIZZ[AE]|PAGAMENTO|LIQUIDAZIONE|Info aggiuntive|PERP|RAMO|CYBER|CREAZIONE|ASSICURATIV).*$/i;

/** Estrae il pagatore da descrizione movimento (BCC, Intesa, ecc.) quando manca colonna Ordinante. */
export function extractOrdinanteFromDescrizione(descrizione: string): string {
  const desc = String(descrizione ?? "").trim();
  if (!desc) return "";

  const ordinanteLabel = desc.match(/ORDINANTE[:\s]+([^/\n]+?)(?:\s{2,}|$|CRO|TRN|IBAN)/i);
  if (ordinanteLabel) return ordinanteLabel[1].trim();

  const da = desc.match(/DA\s+([A-ZÀ-Ü][A-ZÀ-Ü0-9\s&.'-]+?)(?:\s{2,}|$|CRO|TRN|IBAN)/);
  if (da) return da[1].trim();

  const bcc = desc.match(/Bonifico\s+a\s+vs\s+favore\s+\*([^*]+)/i);
  if (bcc) {
    let name = bcc[1].trim();
    name = name.replace(CAUSALE_STOP_RE, "").trim();
    name = name.replace(/\s+\d{4}-\d{5,}-\d{6,}.*$/, "").trim();
    name = name.replace(/\s+\d{10,}.*$/, "").trim();
    return name;
  }

  return desc.split(/\s{2,}|;|\|/)[0].slice(0, 120).trim();
}

/** Normalizza chiavi colonna Excel (spazi iniziali/finali). */
export function normalizeExcelRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim(), v]));
}

/** Risolve ordinante: colonna dedicata, altrimenti estrazione da descrizione. */
export function resolveOrdinanteImport(
  ordinanteRaw: string,
  descrizione: string,
): string {
  const fromCol = String(ordinanteRaw ?? "").trim();
  if (fromCol) return fromCol;
  return extractOrdinanteFromDescrizione(descrizione);
}

/** Conti bancari visibili per una sede (per filtrare movimenti). */
export async function fetchContoIdsForUfficio(ufficioId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("conti_bancari_uffici" as any)
    .select("conto_bancario_id")
    .eq("ufficio_id", ufficioId);
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => r.conto_bancario_id as string);
}

/** Primo ufficio collegato al conto (per ufficio_id su import senza cliente). */
export async function resolveUfficioFromConto(contoBancarioId: string): Promise<string | null> {
  const { data } = await supabase
    .from("conti_bancari_uffici" as any)
    .select("ufficio_id")
    .eq("conto_bancario_id", contoBancarioId)
    .limit(1)
    .maybeSingle();
  return (data as any)?.ufficio_id ?? null;
}

export interface FinalizeMovimentoParams {
  movimentoId: string;
  clienteId: string;
  contoBancarioId: string | null;
  dataMessaCassa: string;
  anticipoImporto: number;
  ammancoImporto: number;
  polizzeLineIds: string[];
  userId: string | null;
  note?: string | null;
}

/**
 * Dopo messa a cassa da ricongiungimento: acconto eccedenza, ammanco contabile, chiusura movimento.
 */
export async function finalizeMovimentoBancarioIncasso(p: FinalizeMovimentoParams): Promise<void> {
  const today = p.dataMessaCassa || new Date().toISOString().slice(0, 10);

  if (p.polizzeLineIds.length > 0) {
    const { error: errMp } = await supabase
      .from("movimenti_polizze" as any)
      .update({ messo_a_cassa: true, data_messa_cassa: today } as any)
      .in("id", p.polizzeLineIds)
      .eq("tipo", "polizza");
    if (errMp) throw errMp;
  }

  const ant = round2(Number(p.anticipoImporto) || 0);
  if (ant > 0) {
    const { error: errAnt } = await supabase.from("cliente_anticipi" as any).insert({
      cliente_id: p.clienteId,
      conto_bancario_id: p.contoBancarioId,
      movimento_bancario_id: p.movimentoId,
      data_anticipo: today,
      importo: ant,
      importo_residuo: ant,
      note: p.note ?? `Eccedenza bonifico movimento ${p.movimentoId.slice(0, 8)}`,
      creato_da: p.userId,
    } as any);
    if (errAnt) throw errAnt;
  }

  const amm = round2(Number(p.ammancoImporto) || 0);
  if (amm > 0) {
    const { data: mov } = await supabase
      .from("movimenti_bancari" as any)
      .select("ufficio_id")
      .eq("id", p.movimentoId)
      .maybeSingle();
    const ufficioId = (mov as any)?.ufficio_id ?? null;
    const { error: errMc } = await supabase.from("movimenti_contabili" as any).insert({
      ufficio_id: ufficioId,
      tipo: "uscita",
      categoria: "ammanco_ricongiungimento",
      riferimento_tipo: "movimento_bancario",
      riferimento_id: p.movimentoId,
      importo: amm,
      data_movimento: today,
      descrizione: `Ammanco bonifico (${p.movimentoId.slice(0, 8)})`,
      stato: "registrato",
      created_by: p.userId,
    } as any);
    if (errMc) throw errMc;
  }

  const { error: errMb } = await supabase
    .from("movimenti_bancari" as any)
    .update({ stato: "incassato" } as any)
    .eq("id", p.movimentoId);
  if (errMb) throw errMb;
}

/** Assegna pagatore (cliente pre-matchato) al movimento. */
export async function assegnaPagatoreMovimento(
  movimentoId: string,
  clienteId: string,
  ufficioId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("movimenti_bancari" as any)
    .update({
      cliente_id: clienteId,
      ufficio_id: ufficioId,
      stato: "assegnato",
    } as any)
    .eq("id", movimentoId);
  if (error) throw error;
}
