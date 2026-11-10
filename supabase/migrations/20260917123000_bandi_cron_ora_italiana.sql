-- cron.timezone è GMT e richiede restart per cambiarlo.
-- Schedule orario feriale + guardia sulle 07:00 Europe/Rome.

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
  IF EXTRACT(ISODOW FROM timezone('Europe/Rome', now())) > 5 THEN
    RETURN 0;
  END IF;
  IF EXTRACT(HOUR FROM timezone('Europe/Rome', now()))::int <> 7 THEN
    RETURN 0;
  END IF;

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

SELECT cron.schedule(
  'bandi-cron-mattina',
  '0 * * * 1-5',
  $$SELECT public.invoke_bandi_cron_mattina()$$
);
