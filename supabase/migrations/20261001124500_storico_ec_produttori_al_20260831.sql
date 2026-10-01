-- E/C Produttori: pregresso fino al 31/08/2026 a storico.
-- Stesso effetto di "Conferma pagamento" (segna_ec_produttore_pagato) su tutte le provvigioni
-- commerciale/AE non statistiche ancora da liquidare con messa a cassa <= 31/08/2026.
-- Gli id aggiornati restano in log_attivita (azione storico_ec_produttori_al_20260831) per l'eventuale rollback:
--   UPDATE provvigioni_generate SET pagata = false
--   WHERE id IN (SELECT jsonb_array_elements_text(dettagli_json->'provvigioni_ids')::uuid
--                FROM log_attivita WHERE azione = 'storico_ec_produttori_al_20260831');

DO $$
DECLARE
  v_ids uuid[];
  v_totale numeric;
BEGIN
  SELECT array_agg(pg.id), COALESCE(sum(pg.importo_provvigione), 0)
  INTO v_ids, v_totale
  FROM public.provvigioni_generate pg
  JOIN public.titoli t ON t.id = pg.titolo_id
  WHERE pg.tipo_destinatario IN ('commerciale', 'ae')
    AND pg.solo_statistico = false
    AND COALESCE(pg.pagata, false) = false
    AND t.data_messa_cassa IS NOT NULL
    AND t.data_messa_cassa <= DATE '2026-08-31';

  IF v_ids IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.provvigioni_generate
  SET pagata = true
  WHERE id = ANY(v_ids);

  INSERT INTO public.log_attivita (azione, entita_tipo, severity, dettagli_json)
  VALUES (
    'storico_ec_produttori_al_20260831',
    'provvigioni_generate',
    'info',
    jsonb_build_object(
      'periodo_a', DATE '2026-08-31',
      'provvigioni_count', array_length(v_ids, 1),
      'totale_provvigioni', v_totale,
      'provvigioni_ids', to_jsonb(v_ids),
      'note', 'Chiusura pregressa E/C Produttori a storico (nessun bonifico generato)'
    )
  );
END $$;
