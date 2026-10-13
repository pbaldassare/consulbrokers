-- Default commerciali clienti Roma:
--   AE = SEDE ROMA (Roma uno + ROMA 2 EXE)
--   Specialist = quello già scritto sulle polizze (i quattro di Roma uno).
-- Non tocca gli specialist EXE (romaexe) né Ballerini.

DO $$
DECLARE
  v_sede_roma uuid := 'b4de1f42-d7f8-4bbc-974d-12abaffc8ee1';
  v_roma_uno uuid := 'cdb3a9e1-2603-4147-819e-2bf5729c6731';
  v_roma_exe uuid := 'c83a748c-653f-4cbd-b075-b399eccdd1b1';
  v_ae int;
  v_def int;
  v_bo int;
  v_tit int;
BEGIN
  INSERT INTO public.codici_commerciali_cliente (cliente_id, ruolo, anagrafica_id, profilo_id, escludi_provvigioni)
  SELECT c.id, 'AE', v_sede_roma, NULL, false
  FROM public.clienti c
  WHERE c.ufficio_id IN (v_roma_uno, v_roma_exe)
  ON CONFLICT (cliente_id, ruolo) DO UPDATE
    SET anagrafica_id = EXCLUDED.anagrafica_id,
        profilo_id = NULL;
  GET DIAGNOSTICS v_ae = ROW_COUNT;

  INSERT INTO public.clienti_intermediari_default (
    cliente_id, tipo, anagrafica_commerciale_id, percentuale, ordine, escludi_provvigioni
  )
  SELECT c.id, 'ae', v_sede_roma, 0, 0, false
  FROM public.clienti c
  WHERE c.ufficio_id IN (v_roma_uno, v_roma_exe)
    AND NOT EXISTS (
      SELECT 1 FROM public.clienti_intermediari_default d
      WHERE d.cliente_id = c.id
        AND d.tipo = 'ae'
        AND d.anagrafica_commerciale_id = v_sede_roma
    );
  GET DIAGNOSTICS v_def = ROW_COUNT;

  UPDATE public.titoli t
  SET ae_anagrafica_id = v_sede_roma
  WHERE t.ufficio_id IN (v_roma_uno, v_roma_exe)
    AND t.ae_anagrafica_id IS NULL;
  GET DIAGNOSTICS v_tit = ROW_COUNT;

  INSERT INTO public.codici_commerciali_cliente (cliente_id, ruolo, profilo_id, anagrafica_id, escludi_provvigioni)
  SELECT s.cliente_id, 'Backoffice', s.profilo_id, NULL, false
  FROM (
    SELECT c.id AS cliente_id,
           CASE upper(trim(t.specialist))
             WHEN 'PAPARELLA FRANCESCO' THEN 'c1c29591-a279-4be5-b5ea-4df9696cf62e'::uuid
             WHEN 'GUGLIELMINI ANTONINO' THEN '9d288274-03a2-412e-9153-1317a9b9b9e8'::uuid
             WHEN 'BARTOCCI FEDERICO' THEN '61079162-d2db-4abb-b559-0e4c2e3127a9'::uuid
             WHEN 'MAGALLI MANUELA' THEN '6047f92f-37f7-4818-9a05-132cb53787db'::uuid
           END AS profilo_id,
           COUNT(*) AS n,
           row_number() OVER (
             PARTITION BY c.id
             ORDER BY COUNT(*) DESC, upper(trim(t.specialist))
           ) AS rk
    FROM public.clienti c
    JOIN public.titoli t ON t.cliente_anagrafica_id = c.id
    WHERE c.ufficio_id = v_roma_uno
      AND t.specialist IS NOT NULL
      AND trim(t.specialist) <> ''
    GROUP BY c.id, upper(trim(t.specialist))
  ) s
  WHERE s.rk = 1 AND s.profilo_id IS NOT NULL
  ON CONFLICT (cliente_id, ruolo) DO UPDATE
    SET profilo_id = EXCLUDED.profilo_id,
        anagrafica_id = NULL;
  GET DIAGNOSTICS v_bo = ROW_COUNT;

  RAISE NOTICE 'ae=% default=% titoli_ae=% specialist_roma_uno=%', v_ae, v_def, v_tit, v_bo;
END $$;
