-- Catene import legacy: madre a premio 0 (frontespizio) non blocca la quietanza con premio.
-- Ripristino garantito errato su Gramazio Domenico 0771.1010008003 (admin test).

CREATE OR REPLACE FUNCTION public.blocca_incasso_fuori_sequenza()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_chiave text;
  v_ord_new int;
  v_ultimo record;
  v_prima record;
BEGIN
  IF current_setting('app.bypass_messa_cassa_lock', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF OLD.data_messa_cassa IS NOT NULL OR NEW.data_messa_cassa IS NULL THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.is_regolazione, false) OR COALESCE(NEW.is_proroga, false)
     OR COALESCE(NEW.is_appendice_modifica, false)
     OR COALESCE(NEW.is_oneri_sospensione, false) OR COALESCE(NEW.is_oneri_riattivazione, false) THEN
    RETURN NEW;
  END IF;

  v_chiave := UPPER(TRIM(COALESCE(NEW.sostituisce_polizza, NEW.numero_titolo, '')));
  IF v_chiave = '' THEN
    RETURN NEW;
  END IF;
  v_ord_new := CASE WHEN NEW.sostituisce_polizza IS NULL THEN 0 ELSE 1 END;

  SELECT CASE WHEN t.sostituisce_polizza IS NULL THEN 0 ELSE 1 END AS ord,
         t.garanzia_da, COALESCE(t.riga, 0) AS riga
    INTO v_ultimo
    FROM public.titoli t
   WHERE t.id <> NEW.id
     AND t.compagnia_id IS NOT DISTINCT FROM NEW.compagnia_id
     AND UPPER(TRIM(COALESCE(t.sostituisce_polizza, t.numero_titolo, ''))) = v_chiave
     AND t.data_messa_cassa IS NOT NULL
     AND NOT (COALESCE(t.is_regolazione, false) OR COALESCE(t.is_proroga, false)
              OR COALESCE(t.is_appendice_modifica, false)
              OR COALESCE(t.is_oneri_sospensione, false) OR COALESCE(t.is_oneri_riattivazione, false))
     AND (CASE WHEN t.sostituisce_polizza IS NULL THEN 0 ELSE 1 END,
          COALESCE(t.garanzia_da, '-infinity'::date), COALESCE(t.riga, 0))
       < (v_ord_new, COALESCE(NEW.garanzia_da, '-infinity'::date), COALESCE(NEW.riga, 0))
   ORDER BY 1 DESC, 2 DESC NULLS LAST, 3 DESC
   LIMIT 1;

  SELECT t.numero_titolo, t.garanzia_da
    INTO v_prima
    FROM public.titoli t
   WHERE t.id <> NEW.id
     AND t.compagnia_id IS NOT DISTINCT FROM NEW.compagnia_id
     AND UPPER(TRIM(COALESCE(t.sostituisce_polizza, t.numero_titolo, ''))) = v_chiave
     AND t.stato IN ('attivo', 'sospeso')
     AND t.data_messa_cassa IS NULL
     AND NOT (COALESCE(t.is_regolazione, false) OR COALESCE(t.is_proroga, false)
              OR COALESCE(t.is_appendice_modifica, false)
              OR COALESCE(t.is_oneri_sospensione, false) OR COALESCE(t.is_oneri_riattivazione, false))
     AND (CASE WHEN t.sostituisce_polizza IS NULL THEN 0 ELSE 1 END,
          COALESCE(t.garanzia_da, '-infinity'::date), COALESCE(t.riga, 0))
       < (v_ord_new, COALESCE(NEW.garanzia_da, '-infinity'::date), COALESCE(NEW.riga, 0))
     AND (v_ultimo.ord IS NULL
          OR (CASE WHEN t.sostituisce_polizza IS NULL THEN 0 ELSE 1 END,
              COALESCE(t.garanzia_da, '-infinity'::date), COALESCE(t.riga, 0))
           > (v_ultimo.ord, COALESCE(v_ultimo.garanzia_da, '-infinity'::date), v_ultimo.riga))
     AND NOT (
       t.sostituisce_polizza IS NULL
       AND COALESCE(t.premio_lordo, 0) = 0
       AND EXISTS (
         SELECT 1
         FROM public.titoli q
         WHERE q.compagnia_id IS NOT DISTINCT FROM NEW.compagnia_id
           AND UPPER(TRIM(COALESCE(q.sostituisce_polizza, q.numero_titolo, ''))) = v_chiave
           AND q.sostituisce_polizza IS NOT NULL
           AND COALESCE(q.premio_lordo, 0) > 0
           AND (q.data_messa_cassa IS NULL OR q.id = NEW.id)
           AND NOT (COALESCE(q.is_regolazione, false) OR COALESCE(q.is_proroga, false)
                    OR COALESCE(q.is_appendice_modifica, false)
                    OR COALESCE(q.is_oneri_sospensione, false) OR COALESCE(q.is_oneri_riattivazione, false))
       )
     )
   ORDER BY CASE WHEN t.sostituisce_polizza IS NULL THEN 0 ELSE 1 END,
            t.garanzia_da NULLS FIRST, COALESCE(t.riga, 0)
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Titolo % (garanzia dal %): prima va incassato % (garanzia dal %).',
      COALESCE(NEW.numero_titolo, NEW.id::text),
      COALESCE(to_char(NEW.garanzia_da, 'DD/MM/YYYY'), '—'),
      v_prima.numero_titolo,
      COALESCE(to_char(v_prima.garanzia_da, 'DD/MM/YYYY'), '—');
  END IF;

  RETURN NEW;
END;
$function$;

-- Annulla garantito admin su polizza madre Gramazio (senza nuove notifiche).
UPDATE public.titoli
SET
  data_copertura = NULL,
  data_messa_cassa = NULL,
  data_incasso = NULL,
  data_pagamento = NULL,
  importo_incassato = NULL,
  banca_pagamento = NULL,
  tipo_pagamento = NULL,
  conferimento_gestito = false,
  fondi_ricevuti = true,
  data_conferimento_gestito = NULL,
  data_decorrenza_rinnovo = NULL,
  updated_at = now()
WHERE id = '97065ea1-c6cc-437c-922a-8a099f12df3e';

DELETE FROM public.documenti
WHERE id = '5c791336-1ea7-4cfa-9294-9d61b850bc1d';

UPDATE public.quietanze
SET data_copertura = NULL, updated_at = now()
WHERE titolo_id = '97065ea1-c6cc-437c-922a-8a099f12df3e';
