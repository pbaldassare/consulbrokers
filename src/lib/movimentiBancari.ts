import { supabase } from "@/integrations/supabase/client";

const round2 = (n: number) => Math.round(n * 100) / 100;

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
      descrizione: `Ammanco ricongiungimento bancario (${p.movimentoId.slice(0, 8)})`,
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
