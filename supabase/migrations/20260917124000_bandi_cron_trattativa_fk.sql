-- Non copiare in storico_gare.trattativa_id i link orfani di bandi_trattative.

CREATE OR REPLACE FUNCTION public.bandi_marca_scaduti_e_archivia()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oggi date := (timezone('Europe/Rome', now()))::date;
  v_marcati int := 0;
  v_archiviati int := 0;
BEGIN
  UPDATE public.bandi_pubblici
  SET
    stato = 'scaduto',
    updated_at = now()
  WHERE scadenza IS NOT NULL
    AND scadenza < v_oggi
    AND stato IS DISTINCT FROM 'scaduto';
  GET DIAGNOSTICS v_marcati = ROW_COUNT;

  WITH candidati AS (
    SELECT
      bp.*,
      (
        SELECT bt.trattativa_id
        FROM public.bandi_trattative bt
        JOIN public.trattative t ON t.id = bt.trattativa_id
        WHERE bt.bando_id = bp.id
        LIMIT 1
      ) AS trattativa_collegata
    FROM public.bandi_pubblici bp
    LEFT JOIN public.bandi_interesse bi ON bi.bando_id = bp.id
    WHERE bp.scadenza IS NOT NULL
      AND bp.scadenza < v_oggi
      AND bi.storico_gara_id IS NULL
      AND COALESCE(bi.cantiere_stato, '') IS DISTINCT FROM 'archiviato_storico'
      AND COALESCE(bi.cantiere_stato, '') IS DISTINCT FROM 'abbandonato'
      AND (
        bi.esito IN ('voglio_partecipare', 'in_trattativa')
        OR bi.cantiere_stato IN (
          'da_approfondire',
          'in_monitoraggio',
          'pronto_trattativa',
          'in_trattativa'
        )
        OR EXISTS (
          SELECT 1
          FROM public.bandi_trattative bt
          JOIN public.trattative t ON t.id = bt.trattativa_id
          WHERE bt.bando_id = bp.id
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.storico_gare sg WHERE sg.bando_id = bp.id
      )
  ),
  inserted AS (
    INSERT INTO public.storico_gare (
      anno_riferimento,
      ente_nome,
      tipologia,
      esito,
      data_inizio_mandato,
      data_fine_mandato,
      data_consegna,
      note,
      bando_id,
      trattativa_id,
      source_file
    )
    SELECT
      COALESCE(
        EXTRACT(YEAR FROM COALESCE(c.data_pubblicazione, c.scadenza, c.servizio_da))::int,
        EXTRACT(YEAR FROM v_oggi)::int
      ),
      UPPER(TRIM(REGEXP_REPLACE(
        COALESCE(NULLIF(TRIM(c.ente), ''), 'ENTE SCONOSCIUTO'),
        '\s+',
        ' ',
        'g'
      ))),
      'gara',
      CASE
        WHEN COALESCE(c.aggiudicato, false) OR c.tipo_avviso = 'esito'
          THEN 'non_classificato'
        ELSE 'in_corso'
      END,
      c.servizio_da,
      c.servizio_a,
      COALESCE(c.scadenza, c.data_pubblicazione),
      concat_ws(
        E'\n',
        NULLIF(TRIM(COALESCE(c.titolo, c.oggetto, '')), ''),
        CASE WHEN NULLIF(TRIM(COALESCE(c.cig, '')), '') IS NOT NULL
          THEN 'CIG: ' || TRIM(c.cig) END,
        CASE WHEN NULLIF(TRIM(COALESCE(c.link, '')), '') IS NOT NULL
          THEN 'Link: ' || TRIM(c.link) END,
        CASE WHEN NULLIF(TRIM(COALESCE(c.aggiudicatario, '')), '') IS NOT NULL
          THEN 'Aggiudicatario: ' || TRIM(c.aggiudicatario) END,
        CASE WHEN COALESCE(NULLIF(TRIM(c.localita), ''), NULLIF(TRIM(c.regione), '')) IS NOT NULL
          THEN 'Luogo: ' || concat_ws(', ', NULLIF(TRIM(c.localita), ''), NULLIF(TRIM(c.regione), ''))
        END,
        'Origine: Bandi partecipati CBnet'
      ),
      c.id,
      c.trattativa_collegata,
      'cbnet-bandi-cron-mattina'
    FROM candidati c
    RETURNING id, bando_id
  ),
  linked AS (
    INSERT INTO public.bandi_interesse (
      bando_id,
      esito,
      cantiere_stato,
      cantiere_il,
      storico_gara_id,
      snapshot_json
    )
    SELECT
      i.bando_id,
      COALESCE(bi.esito, 'voglio_partecipare'),
      'archiviato_storico',
      now(),
      i.id,
      COALESCE(bi.snapshot_json, '{}'::jsonb)
    FROM inserted i
    LEFT JOIN public.bandi_interesse bi ON bi.bando_id = i.bando_id
    ON CONFLICT (bando_id) DO UPDATE SET
      cantiere_stato = 'archiviato_storico',
      cantiere_il = now(),
      storico_gara_id = EXCLUDED.storico_gara_id
    RETURNING bando_id
  )
  SELECT COUNT(*)::int INTO v_archiviati FROM linked;

  RETURN jsonb_build_object(
    'oggi', v_oggi,
    'marcati_scaduti', v_marcati,
    'archiviati_storico', v_archiviati
  );
END;
$$;
