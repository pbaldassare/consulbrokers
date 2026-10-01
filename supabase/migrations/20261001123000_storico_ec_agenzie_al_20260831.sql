-- E/C Agenzie: tutto il pregresso fino al 31/08/2026 passa a storico.
-- Per ogni agenzia una rimessa "pagata" (senza bonifico/SEPA) con i titoli che l'E/C
-- mostrava fino a quella data: incassati con messa a cassa <= 31/08 e coperture
-- garantite con data copertura <= 31/08, non già in rimessa.
-- Rollback: eliminare le rimesse con note LIKE 'Storico E/C Agenzie: chiusura pregressa al 31/08/2026%'
-- (rimessa_dettaglio prima, poi rimessa_premi).

CREATE INDEX IF NOT EXISTS idx_rimessa_dettaglio_titolo ON public.rimessa_dettaglio (titolo_id);

-- Un titolo non può stare in due rimesse attive (le liste lato client sono troncate a 1000 righe).
CREATE OR REPLACE FUNCTION public.trg_rimessa_dettaglio_titolo_unico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.titolo_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.rimessa_dettaglio rd
    JOIN public.rimessa_premi rp ON rp.id = rd.rimessa_id
    WHERE rd.titolo_id = NEW.titolo_id
      AND rd.rimessa_id <> NEW.rimessa_id
      AND rp.stato <> 'annullata'
  ) THEN
    RAISE EXCEPTION 'Titolo % già incluso in un''altra rimessa', NEW.titolo_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_rimessa_dettaglio_titolo_unico() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_rimessa_dettaglio_titolo_unico ON public.rimessa_dettaglio;
CREATE TRIGGER trg_rimessa_dettaglio_titolo_unico
  BEFORE INSERT ON public.rimessa_dettaglio
  FOR EACH ROW EXECUTE FUNCTION public.trg_rimessa_dettaglio_titolo_unico();

DO $$
DECLARE
  v_al constant date := '2026-08-31';
  v_note constant text := 'Storico E/C Agenzie: chiusura pregressa al 31/08/2026 (nessun bonifico generato)';
  r record;
  v_rimessa uuid;
BEGIN
  CREATE TEMP TABLE _storico_ec ON COMMIT DROP AS
  SELECT t.id,
         t.compagnia_id,
         CASE WHEN t.pag_diretto_compagnia THEN 0 ELSE COALESCE(t.premio_lordo, 0) END AS importo
  FROM public.titoli t
  WHERE t.compagnia_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.rimessa_dettaglio rd WHERE rd.titolo_id = t.id)
    AND (
      (t.stato = 'incassato' AND t.data_messa_cassa <= v_al)
      OR (t.stato = 'attivo' AND t.conferimento_gestito AND t.data_copertura IS NOT NULL
          AND t.data_copertura <= v_al AND t.data_messa_cassa IS NULL)
    );

  FOR r IN
    SELECT compagnia_id, count(*)::int AS n, round(sum(importo), 2) AS tot
    FROM _storico_ec
    GROUP BY compagnia_id
  LOOP
    INSERT INTO public.rimessa_premi
      (compagnia_id, totale_importi, importo_pagato, stato, data_pagamento_rimessa, n_titoli, note)
    VALUES
      (r.compagnia_id, r.tot, r.tot, 'pagata', v_al, r.n, v_note)
    RETURNING id INTO v_rimessa;

    INSERT INTO public.rimessa_dettaglio (rimessa_id, titolo_id, quietanza_id, importo)
    SELECT v_rimessa,
           s.id,
           (SELECT q.id FROM public.quietanze q WHERE q.titolo_id = s.id LIMIT 1),
           s.importo
    FROM _storico_ec s
    WHERE s.compagnia_id = r.compagnia_id;
  END LOOP;
END $$;
