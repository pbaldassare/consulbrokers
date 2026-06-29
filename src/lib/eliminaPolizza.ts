import { supabase } from "@/integrations/supabase/client";

export type EliminaPolizzaResult = {
  ok: boolean;
  error?: string;
  titoliEliminati?: number;
  quietanzeEliminate?: number;
  polizzeEliminate?: number;
  provvigioniEliminate?: number;
  movimentiPolizzeEliminati?: number;
  includevaProvvigioniPagate?: boolean;
};

function mapFinResult(r: Record<string, unknown>): EliminaPolizzaResult {
  if (r.ok === false) {
    return { ok: false, error: (r.error as string) || "Errore eliminazione" };
  }
  return {
    ok: true,
    titoliEliminati: (r.titoli_eliminati as number) ?? 0,
    quietanzeEliminate: (r.quietanze_eliminate as number) ?? 0,
    polizzeEliminate: (r.polizze_eliminate as number) ?? 0,
    provvigioniEliminate: (r.provvigioni_eliminate as number) ?? 0,
    movimentiPolizzeEliminati: (r.movimenti_polizze_eliminati as number) ?? 0,
    includevaProvvigioniPagate: !!r.includeva_provvigioni_pagate,
  };
}

/**
 * Eliminazione fisica polizza madre + catena quietanze via RPC `elimina_polizza_cascade`.
 * Pulisce incassi, movimenti bancari, provvigioni, rimesse, ecc. Solo admin.
 */
export async function eliminaPolizza(titoloId: string): Promise<EliminaPolizzaResult> {
  const { data, error } = await (supabase as any).rpc("elimina_polizza_cascade", {
    p_titolo_id: titoloId,
  });
  if (error) return { ok: false, error: error.message };
  return mapFinResult((data ?? {}) as Record<string, unknown>);
}

/**
 * Eliminazione fisica singola quietanza via RPC `elimina_quietanza_cascade`. Solo admin.
 */
export async function eliminaQuietanza(titoloId: string): Promise<EliminaPolizzaResult> {
  const { data, error } = await (supabase as any).rpc("elimina_quietanza_cascade", {
    p_titolo_id: titoloId,
  });
  if (error) return { ok: false, error: error.message };
  return mapFinResult((data ?? {}) as Record<string, unknown>);
}
