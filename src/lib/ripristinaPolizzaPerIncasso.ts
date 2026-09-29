import { supabase } from "@/integrations/supabase/client";

export type RipristinaPolizzaResult = { ok: boolean; error?: string };

/** La polizza è la prima rata: da annullata si riporta ad attiva e si mette a cassa su questa riga. */
export function puoAprireIncasso(
  stato: string | null | undefined,
  dataMessaCassa?: string | null,
  opts?: { poliennale?: boolean; garantitoAperto?: boolean },
): boolean {
  const s = (stato || "").toLowerCase();
  if (s !== "attivo" && s !== "annullato") return false;
  return !dataMessaCassa || !!opts?.poliennale || !!opts?.garantitoAperto;
}

/**
 * Riporta titolo `annullato` → `attivo` e il contratto `polizze` → `attiva`.
 * Non ricrea quietanze: la polizza è già la prima rata incassabile.
 */
export async function ripristinaPolizzaPerIncasso(titoloId: string): Promise<RipristinaPolizzaResult> {
  const now = new Date().toISOString();
  const { data: titolo, error: readErr } = await supabase
    .from("titoli")
    .select("id, stato, polizza_id")
    .eq("id", titoloId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!titolo) return { ok: false, error: "Titolo non trovato" };

  const { error: updTitolo } = await supabase
    .from("titoli")
    .update({ stato: "attivo", updated_at: now })
    .eq("id", titoloId);
  if (updTitolo) return { ok: false, error: updTitolo.message };

  const { error: updMadre } = await supabase
    .from("polizze")
    .update({ stato: "attiva", updated_at: now })
    .eq("titolo_madre_id", titoloId);
  if (updMadre) return { ok: false, error: updMadre.message };

  if ((titolo as { polizza_id?: string | null }).polizza_id) {
    const { error: updPol } = await supabase
      .from("polizze")
      .update({ stato: "attiva", updated_at: now })
      .eq("id", (titolo as { polizza_id: string }).polizza_id);
    if (updPol) return { ok: false, error: updPol.message };
  }

  return { ok: true };
}
