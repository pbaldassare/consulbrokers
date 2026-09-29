import { supabase } from "@/integrations/supabase/client";
import { pianoCambioNumero } from "@/lib/pianoCambioNumero";

export type CausaleCambioNumero = "sostituzione" | "sospensione" | "riattivazione" | "emittenda";

/**
 * Cambia `numero_titolo`.
 * - Se il titolo è una quietanza: aggiorna solo quella riga, azzera `sostituisce_polizza`
 *   (la riga diventa polizza con il nuovo numero).
 * - Se è la polizza: rinomina tutta la catena (madre + quietanze restano collegate).
 *
 * No-op se `numeroNuovo` è vuoto o uguale a `numeroCorrente`.
 * Ritorna `true` se il cambio è stato effettivamente eseguito.
 */
export async function aggiornaNumeroPolizza(params: {
  titoloId: string;
  numeroCorrente: string | null | undefined;
  numeroNuovo: string | null | undefined;
  causale: CausaleCambioNumero;
  motivo?: string | null;
  riferimentoId?: string | null;
}): Promise<boolean> {
  const { titoloId, numeroCorrente, numeroNuovo, causale, motivo, riferimentoId } = params;
  const nuovo = (numeroNuovo || "").trim();
  const corrente = (numeroCorrente || "").trim();
  if (!nuovo || !corrente || nuovo === corrente) return false;

  const { data: row, error: errLoad } = await supabase
    .from("titoli")
    .select("id, numero_titolo, sostituisce_polizza, is_appendice_modifica, is_proroga, is_regolazione")
    .eq("id", titoloId)
    .maybeSingle();
  if (errLoad) throw errLoad;
  if (!row) throw new Error("Titolo non trovato");

  const piano = pianoCambioNumero(
    {
      id: row.id,
      numero_titolo: corrente,
      sostituisce_polizza: (row as { sostituisce_polizza?: string | null }).sostituisce_polizza,
      is_appendice_modifica: (row as { is_appendice_modifica?: boolean | null }).is_appendice_modifica,
      is_proroga: (row as { is_proroga?: boolean | null }).is_proroga,
      is_regolazione: (row as { is_regolazione?: boolean | null }).is_regolazione,
    },
    nuovo,
  );

  if (piano.mode === "detach-quietanza") {
    const { error: errDet } = await supabase
      .from("titoli")
      .update({
        numero_titolo: nuovo,
        sostituisce_polizza: null,
        sostituisce_riga: null,
      } as any)
      .eq("id", titoloId);
    if (errDet) throw errDet;
  } else if (piano.mode === "rename-chain") {
    // Quietanze: stesso statement su numero + sostituisce, così il trigger
    // di stacco non le promuove a polizza.
    const { error: errQ } = await supabase
      .from("titoli")
      .update({ numero_titolo: nuovo, sostituisce_polizza: nuovo } as any)
      .eq("sostituisce_polizza", corrente);
    if (errQ) throw errQ;

    const { error: errTit } = await supabase
      .from("titoli")
      .update({ numero_titolo: nuovo } as any)
      .eq("numero_titolo", corrente);
    if (errTit) throw errTit;
  } else {
    return false;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { error: errArch } = await supabase.from("titoli_numeri_storici" as any).insert({
    titolo_id: titoloId,
    numero_precedente: corrente,
    numero_nuovo: nuovo,
    causale,
    motivo: motivo || null,
    riferimento_id: riferimentoId || null,
    cambiato_da_user_id: user?.id || null,
  });
  if (errArch) throw errArch;

  return true;
}
