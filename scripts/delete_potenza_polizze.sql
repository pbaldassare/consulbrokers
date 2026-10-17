-- One-shot: cancella TUTTE le polizze della sede Potenza.
-- Non tocca i clienti. Non tocca le polizze protette 204366651 / 6131402092 / RCM00010074404.
-- Ufficio: e4f0d1f5-e344-4920-b178-d8754904a108 (PZ).

DO $$
DECLARE
  v_ufficio uuid := 'e4f0d1f5-e344-4920-b178-d8754904a108';
  v_tit_ids uuid[];
  v_pol_ids uuid[];
  v_qui_ids uuid[];
  c_storni int := 0;
  c_appendici int := 0;
  c_quietanze int := 0;
  c_titoli int := 0;
  c_polizze int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM uffici
    WHERE id = v_ufficio AND codice_ufficio = 'PZ'
  ) THEN
    RAISE EXCEPTION 'Ufficio Potenza non trovato o codice diverso da PZ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM titoli
    WHERE ufficio_id = v_ufficio
      AND numero_titolo IN ('204366651', '6131402092', 'RCM00010074404')
  ) THEN
    RAISE EXCEPTION 'Blocked: sede Potenza contiene numeri polizza protetti';
  END IF;

  PERFORM set_config('app.bypass_premi_lock', 'on', true);
  PERFORM set_config('app.bypass_messa_cassa_lock', 'on', true);

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_tit_ids
  FROM titoli WHERE ufficio_id = v_ufficio;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_pol_ids
  FROM polizze WHERE ufficio_id = v_ufficio;

  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_qui_ids
  FROM quietanze
  WHERE titolo_id = ANY(v_tit_ids) OR polizza_id = ANY(v_pol_ids);

  IF cardinality(v_tit_ids) = 0 AND cardinality(v_pol_ids) = 0 THEN
    RAISE NOTICE 'Nessuna polizza Potenza da cancellare';
    RETURN;
  END IF;

  WITH d AS (DELETE FROM titoli_storni WHERE titolo_id = ANY(v_tit_ids) OR polizza_id = ANY(v_pol_ids) RETURNING 1)
  SELECT count(*) INTO c_storni FROM d;

  WITH d AS (
    DELETE FROM appendici_polizza
    WHERE titolo_id = ANY(v_tit_ids) OR polizza_id = ANY(v_pol_ids)
    RETURNING 1
  )
  SELECT count(*) INTO c_appendici FROM d;

  DELETE FROM titoli_regolazioni
  WHERE titolo_madre_id = ANY(v_tit_ids) OR titolo_regolazione_id = ANY(v_tit_ids);

  DELETE FROM titoli_proroghe
  WHERE titolo_madre_id = ANY(v_tit_ids) OR titolo_proroga_id = ANY(v_tit_ids);

  DELETE FROM rimessa_dettaglio WHERE titolo_id = ANY(v_tit_ids);
  DELETE FROM note_restituzione_dettaglio WHERE titolo_id = ANY(v_tit_ids) OR quietanza_id = ANY(v_qui_ids);
  DELETE FROM movimenti_polizze WHERE titolo_id = ANY(v_tit_ids);
  DELETE FROM movimenti_polizza WHERE titolo_id = ANY(v_tit_ids);
  DELETE FROM movimenti_contabili
  WHERE riferimento_tipo = 'titolo' AND riferimento_id = ANY(v_tit_ids);

  UPDATE sinistri SET titolo_id = NULL
  WHERE titolo_id = ANY(v_tit_ids);

  UPDATE titoli SET
    regolazione_quietanza_id = NULL,
    titolo_storno_id = NULL,
    proroga_polizza_madre_id = NULL,
    appendice_modifica_polizza_madre_id = NULL,
    polizza_id = NULL,
    data_messa_cassa = NULL,
    data_incasso = NULL,
    data_pagamento = NULL,
    importo_incassato = NULL,
    tipo_pagamento = NULL,
    banca_pagamento = NULL,
    conferimento_gestito = false,
    data_conferimento_gestito = NULL
  WHERE id = ANY(v_tit_ids);

  UPDATE quietanze SET titolo_id = NULL WHERE id = ANY(v_qui_ids);

  WITH d AS (DELETE FROM quietanze WHERE id = ANY(v_qui_ids) RETURNING 1)
  SELECT count(*) INTO c_quietanze FROM d;

  WITH d AS (DELETE FROM titoli WHERE id = ANY(v_tit_ids) RETURNING 1)
  SELECT count(*) INTO c_titoli FROM d;

  UPDATE polizze SET
    titolo_madre_id = NULL,
    sostituisce_polizza_id = NULL,
    sostituita_da_polizza_id = NULL
  WHERE id = ANY(v_pol_ids);

  WITH d AS (DELETE FROM polizze WHERE id = ANY(v_pol_ids) RETURNING 1)
  SELECT count(*) INTO c_polizze FROM d;

  RAISE NOTICE 'DELETE POTENZA titoli=% quietanze=% polizze=% appendici=% storni=%',
    c_titoli, c_quietanze, c_polizze, c_appendici, c_storni;
END $$;
