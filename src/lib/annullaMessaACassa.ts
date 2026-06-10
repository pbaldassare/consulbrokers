import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";

export type AnnullaResult = {
  ok: boolean;
  error?: string;
  provvigioniEliminate?: number;
  movimentiEliminati?: number;
};

/**
 * Annulla la "Messa a Cassa" di un titolo:
 * 1. Blocca se esistono provvigioni già pagate
 * 2. Elimina le provvigioni non pagate generate per il titolo
 * 3. Elimina i movimenti contabili collegati (riferimento_tipo='titolo')
 * 4. Resetta i campi del titolo (stato, data_messa_cassa, etc.)
 * 5. Logga l'attività
 */
export async function annullaMessaACassa(titoloId: string): Promise<AnnullaResult> {
  // 1. Blocco se provvigioni già pagate
  const { data: pagate, error: errPag } = await supabase
    .from("provvigioni_generate")
    .select("id")
    .eq("titolo_id", titoloId)
    .eq("pagata", true)
    .limit(1);
  if (errPag) return { ok: false, error: errPag.message };
  if (pagate && pagate.length > 0) {
    return {
      ok: false,
      error: "Impossibile annullare: esistono provvigioni già pagate per questo titolo.",
    };
  }

  // 2. Elimina provvigioni non pagate
  const { data: delProv, error: errDelProv } = await supabase
    .from("provvigioni_generate")
    .delete()
    .eq("titolo_id", titoloId)
    .eq("pagata", false)
    .select("id");
  if (errDelProv) return { ok: false, error: errDelProv.message };

  // 3. Elimina movimenti contabili collegati al titolo
  const { data: delMov, error: errDelMov } = await (supabase.from("movimenti_contabili") as any)
    .delete()
    .eq("riferimento_tipo", "titolo")
    .eq("riferimento_id", titoloId)
    .select("id");
  if (errDelMov) return { ok: false, error: errDelMov.message };

  // 3b. Rilascia anticipi utilizzati per questo titolo (il trigger DB ripristina il residuo)
  await (supabase.from("cliente_anticipi_utilizzi") as any)
    .delete()
    .eq("titolo_id", titoloId);

  // 3c. Elimina compensazioni contabili applicate (movimenti già rimossi al passo 3)
  await (supabase.from("titoli_compensazioni") as any)
    .delete()
    .eq("titolo_id", titoloId);

  // 4. Reset campi titolo
  const { error: errUpd } = await (supabase.from("titoli") as any)
    .update({
      stato: "attivo",
      data_incasso: null,
      data_messa_cassa: null,
      data_pagamento: null,
      data_decorrenza_rinnovo: null,
      importo_incassato: null,
      tipo_pagamento: null,
      banca_pagamento: null,
      conferimento_gestito: false,
      fondi_ricevuti: true,
      data_conferimento_gestito: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", titoloId);
  if (errUpd) return { ok: false, error: errUpd.message };

  // 5. Log
  await logAttivita({
    azione: "annulla_messa_a_cassa",
    entita_tipo: "titolo",
    entita_id: titoloId,
    dettagli_json: {
      provvigioni_eliminate: delProv?.length ?? 0,
      movimenti_eliminati: delMov?.length ?? 0,
    },
    severity: "warning",
  });

  return {
    ok: true,
    provvigioniEliminate: delProv?.length ?? 0,
    movimentiEliminati: delMov?.length ?? 0,
  };
}
