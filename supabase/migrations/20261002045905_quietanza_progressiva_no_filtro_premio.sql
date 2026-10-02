-- Correzione compatibile con database sui quali la migrazione precedente è
-- già stata applicata: una rata esistente deve bloccare il doppione anche se
-- il suo premio è negativo (ad esempio dopo uno storno/reincasso).
DO $migration$
DECLARE
  v_old_definition text;
  v_new_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.genera_quietanza_su_messa_cassa()'::regprocedure
  )
  INTO v_old_definition;

  v_new_definition := REPLACE(
    v_old_definition,
    E'\n      AND COALESCE(t.premio_lordo, 0) >= 0',
    ''
  );

  -- Su un database installato da zero la prima migrazione contiene già la
  -- versione corretta; in tal caso non è necessario ricreare la funzione.
  IF v_new_definition IS DISTINCT FROM v_old_definition THEN
    EXECUTE v_new_definition;
  END IF;
END;
$migration$;
