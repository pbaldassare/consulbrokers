-- Job feriale Bandi Pubblici: 07:00 Europe/Rome, lunedì–venerdì.
-- 1) marca scaduti (scadenza < oggi, stato != scaduto)
-- 2) archivia in storico_gare solo i partecipati/cantiere
-- 3) pg_cron + pg_net invocano l'edge function per la ricerca (tutte le fonti, brokeraggio)

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT USAGE ON SCHEMA net TO postgres;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'project_url') THEN
    PERFORM vault.create_secret(
      'https://zbjmnnlojxprlogbnxef.supabase.co',
      'project_url',
      'URL progetto Supabase CBnet per cron HTTP'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'bandi_cron_secret') THEN
    PERFORM vault.create_secret(
      'bandi-cron-mattina-2026',
      'bandi_cron_secret',
      'Secret job feriale Bandi Pubblici 07:00'
    );
  END IF;
END $$;

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
          SELECT 1 FROM public.bandi_trattative bt WHERE bt.bando_id = bp.id
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

COMMENT ON FUNCTION public.bandi_marca_scaduti_e_archivia() IS
  'Marca bandi_pubblici scaduti e scrive storico_gare solo per i partecipati/cantiere.';

CREATE OR REPLACE FUNCTION public.invoke_bandi_cron_mattina()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_apikey text;
  v_id bigint;
BEGIN
  -- Archivio immediato: non dipende dal timeout HTTP della ricerca.
  PERFORM public.bandi_marca_scaduti_e_archivia();

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'bandi_cron_secret' LIMIT 1;
  SELECT decrypted_secret INTO v_apikey
  FROM vault.decrypted_secrets WHERE name = 'anon_key' LIMIT 1;

  v_url := COALESCE(NULLIF(v_url, ''), 'https://zbjmnnlojxprlogbnxef.supabase.co');
  v_secret := COALESCE(NULLIF(v_secret, ''), 'bandi-cron-mattina-2026');

  SELECT net.http_post(
    url := v_url || '/functions/v1/bandi-cron-mattina',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(NULLIF(v_apikey, ''), v_secret),
      'apikey', COALESCE(v_apikey, ''),
      'x-bandi-cron-secret', v_secret
    ),
    body := jsonb_build_object(
      'secret', v_secret,
      'source', 'pg_cron',
      'action', 'full'
    ),
    timeout_milliseconds := 180000
  ) INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.invoke_bandi_cron_mattina() IS
  'Cron 07:00 Europe/Rome lun-ven: archivia scaduti e avvia la ricerca bandi.';

REVOKE ALL ON FUNCTION public.bandi_marca_scaduti_e_archivia() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoke_bandi_cron_mattina() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bandi_marca_scaduti_e_archivia() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.invoke_bandi_cron_mattina() TO postgres;

SELECT cron.schedule(
  'bandi-cron-mattina',
  '0 7 * * 1-5',
  $$SELECT public.invoke_bandi_cron_mattina()$$
);

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'bandi-cron-mattina';
  IF v_jobid IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'cron' AND table_name = 'job' AND column_name = 'timezone'
  ) THEN
    EXECUTE format('UPDATE cron.job SET timezone = %L WHERE jobid = %s', 'Europe/Rome', v_jobid);
  ELSE
    BEGIN
      PERFORM cron.alter_job(v_jobid, schedule := '0 7 * * 1-5');
      EXECUTE 'ALTER DATABASE postgres SET cron.timezone TO ''Europe/Rome''';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Timezone cron Europe/Rome non impostata: %', SQLERRM;
    END;
  END IF;
END $$;
