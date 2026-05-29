import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";

export type AnnullaPolizzaResult = {
  ok: boolean;
  error?: string;
  quietanzeEliminate?: number;
  provvigioniEliminate?: number;
  pagamentiRigheEliminate?: number;
  rimessaDettagliEliminati?: number;
  movimentiEliminati?: number;
  movimentiPolizzaEliminati?: number;
  splitsEliminati?: number;
  includevaProvvigioniPagate?: boolean;
};

/**
 * Annulla una polizza/quietanza con cascade-delete totale.
 * - Elimina TUTTE le entità collegate (anche pagate): provvigioni, righe pagamento, rimesse, movimenti, splits
 * - Elimina ricorsivamente le quietanze discendenti (titoli figli)
 * - Lascia il record `titoli` target in stato 'annullato' come ancoraggio per log_attivita
 * - Se il target è una quietanza singola, tocca solo lei + i suoi discendenti (non la madre né le sorelle)
 */
export async function annullaPolizza(titoloId: string): Promise<AnnullaPolizzaResult> {
  // 1. Carica titolo target
  const { data: titolo, error: errT } = await supabase
    .from("titoli")
    .select("id, numero_titolo, riga")
    .eq("id", titoloId)
    .maybeSingle();
  if (errT) return { ok: false, error: errT.message };
  if (!titolo) return { ok: false, error: "Titolo non trovato" };

  // 2. Trova ricorsivamente le quietanze discendenti
  const quietanzeIds: string[] = [];
  const queue: Array<{ numero_titolo: string; riga: number }> = [
    { numero_titolo: titolo.numero_titolo, riga: titolo.riga },
  ];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const { data: figlie, error: errF } = await supabase
      .from("titoli")
      .select("id, numero_titolo, riga")
      .eq("sostituisce_polizza", cur.numero_titolo)
      .eq("sostituisce_riga", cur.riga);
    if (errF) return { ok: false, error: `Errore lookup quietanze: ${errF.message}` };
    for (const f of figlie ?? []) {
      if (!quietanzeIds.includes(f.id)) {
        quietanzeIds.push(f.id);
        queue.push({ numero_titolo: f.numero_titolo, riga: f.riga });
      }
    }
  }

  const idsToClean = [titoloId, ...quietanzeIds];

  // 3. Verifica se ci sono provvigioni già pagate (solo per log)
  const { data: provPagate } = await supabase
    .from("provvigioni_generate")
    .select("id")
    .in("titolo_id", idsToClean)
    .eq("pagata", true)
    .limit(1);
  const includevaProvvigioniPagate = (provPagate?.length ?? 0) > 0;

  // 4. Carica provvigioni_generate per ottenere gli id (servono per pagamenti_provvigioni_righe)
  const { data: provIds, error: errProvIds } = await supabase
    .from("provvigioni_generate")
    .select("id")
    .in("titolo_id", idsToClean);
  if (errProvIds) return { ok: false, error: `Errore lookup provvigioni: ${errProvIds.message}` };
  const provvigioniIds = (provIds ?? []).map((p) => p.id);

  // 5. CASCADE DELETE in ordine FK-safe

  // 5a. pagamenti_provvigioni_righe
  let pagamentiRigheEliminate = 0;
  if (provvigioniIds.length > 0) {
    const { data: delPR, error: errDelPR } = await (supabase.from("pagamenti_provvigioni_righe") as any)
      .delete()
      .in("provvigione_id", provvigioniIds)
      .select("id");
    if (errDelPR) return { ok: false, error: `Errore delete pagamenti_righe: ${errDelPR.message}` };
    pagamentiRigheEliminate = delPR?.length ?? 0;
  }

  // 5b. provvigioni_generate
  const { data: delProv, error: errDelProv } = await supabase
    .from("provvigioni_generate")
    .delete()
    .in("titolo_id", idsToClean)
    .select("id");
  if (errDelProv) return { ok: false, error: `Errore delete provvigioni: ${errDelProv.message}` };

  // 5c. rimessa_dettaglio
  const { data: delRD, error: errDelRD } = await (supabase.from("rimessa_dettaglio") as any)
    .delete()
    .in("titolo_id", idsToClean)
    .select("id");
  if (errDelRD) return { ok: false, error: `Errore delete rimessa_dettaglio: ${errDelRD.message}` };

  // 5d. movimenti_contabili
  const { data: delMC, error: errDelMC } = await (supabase.from("movimenti_contabili") as any)
    .delete()
    .eq("riferimento_tipo", "titolo")
    .in("riferimento_id", idsToClean)
    .select("id");
  if (errDelMC) return { ok: false, error: `Errore delete movimenti_contabili: ${errDelMC.message}` };

  // 5e. movimenti_polizza
  const { data: delMP, error: errDelMP } = await (supabase.from("movimenti_polizza") as any)
    .delete()
    .in("titolo_id", idsToClean)
    .select("id");
  if (errDelMP) return { ok: false, error: `Errore delete movimenti_polizza: ${errDelMP.message}` };

  // 5f. titoli_split_commerciali
  const { data: delSp, error: errDelSp } = await (supabase.from("titoli_split_commerciali") as any)
    .delete()
    .in("titolo_id", idsToClean)
    .select("id");
  if (errDelSp) return { ok: false, error: `Errore delete splits: ${errDelSp.message}` };

  // 5g. Quietanze discendenti (delete fisica)
  let quietanzeEliminate = 0;
  if (quietanzeIds.length > 0) {
    const { data: delQ, error: errDelQ } = await supabase
      .from("titoli")
      .delete()
      .in("id", quietanzeIds)
      .select("id");
    if (errDelQ) return { ok: false, error: `Errore delete quietanze: ${errDelQ.message}` };
    quietanzeEliminate = delQ?.length ?? 0;
  }

  // 6. Reset titolo target → stato 'annullato'
  const { error: errUpd } = await (supabase.from("titoli") as any)
    .update({
      stato: "annullato",
      data_messa_cassa: null,
      data_incasso: null,
      data_pagamento: null,
      importo_incassato: null,
      tipo_pagamento: null,
      banca_pagamento: null,
      conferimento_gestito: false,
      data_conferimento_gestito: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", titoloId);
  if (errUpd) return { ok: false, error: `Errore update titolo: ${errUpd.message}` };

  // 7. Log unico
  await logAttivita({
    azione: "annullamento_polizza_cascade",
    entita_tipo: "titolo",
    entita_id: titoloId,
    severity: "warning",
    dettagli_json: {
      quietanze_eliminate: quietanzeEliminate,
      provvigioni_eliminate: delProv?.length ?? 0,
      pagamenti_righe_eliminate: pagamentiRigheEliminate,
      rimessa_dettagli_eliminati: delRD?.length ?? 0,
      movimenti_eliminati: delMC?.length ?? 0,
      movimenti_polizza_eliminati: delMP?.length ?? 0,
      splits_eliminati: delSp?.length ?? 0,
      includeva_provvigioni_pagate: includevaProvvigioniPagate,
    },
  });

  return {
    ok: true,
    quietanzeEliminate,
    provvigioniEliminate: delProv?.length ?? 0,
    pagamentiRigheEliminate,
    rimessaDettagliEliminati: delRD?.length ?? 0,
    movimentiEliminati: delMC?.length ?? 0,
    movimentiPolizzaEliminati: delMP?.length ?? 0,
    splitsEliminati: delSp?.length ?? 0,
    includevaProvvigioniPagate,
  };
}
