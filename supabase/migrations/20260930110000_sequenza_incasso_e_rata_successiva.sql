-- Regola 30/09/2026: in una catena polizza + quietanze si mette a cassa solo
-- il primo titolo non incassato in ordine di garanzia (prima la polizza).
-- Catene del modello precedente con titoli aperti rimasti indietro rispetto a
-- uno già incassato: la sequenza riparte dopo l'ultimo incassato.
-- Appendici (RG / AM / PR / oneri) fuori sequenza.

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

  -- Ultimo titolo già a cassa che precede quello in incasso.
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

DROP TRIGGER IF EXISTS trg_blocca_incasso_fuori_sequenza ON public.titoli;
CREATE TRIGGER trg_blocca_incasso_fuori_sequenza
  BEFORE UPDATE OF data_messa_cassa ON public.titoli
  FOR EACH ROW EXECUTE FUNCTION public.blocca_incasso_fuori_sequenza();

-- Rata successiva generata all'incasso: parte dalla fine garanzia del titolo
-- incassato e non crea spezzoni (meno di un mese) a ridosso di fine durata.
CREATE OR REPLACE FUNCTION public.genera_quietanza_su_messa_cassa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_months_period int;
  v_durata_months int;
  v_is_poliennale boolean := false;
  v_frazionamento text;
  v_new_da date;
  v_new_a date;
  v_new_gar_da date;
  v_new_gar_a date;
  v_new_riga int;
  v_existing_id uuid;
  v_new_id uuid;
  v_madre_durata_a date;
BEGIN
  IF NEW.stato <> 'incassato' OR OLD.stato = 'incassato' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_regolazione, false) OR COALESCE(NEW.is_proroga, false)
     OR COALESCE(NEW.is_appendice_modifica, false)
     OR COALESCE(NEW.is_oneri_sospensione, false) OR COALESCE(NEW.is_oneri_riattivazione, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.numero_titolo IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.titoli
    WHERE numero_titolo = NEW.numero_titolo
      AND sostituisce_polizza IS NULL
      AND COALESCE(polizza_temporanea, false) = true
  ) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.titoli
    WHERE numero_titolo = NEW.numero_titolo
      AND sostituisce_polizza IS NULL
      AND LOWER(TRIM(COALESCE(frazionamento, ''))) IN ('premio unico anticipato', 'rata unica', 'unica')
  ) OR LOWER(TRIM(COALESCE(NEW.frazionamento, ''))) IN ('premio unico anticipato', 'rata unica', 'unica') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.titoli
    WHERE numero_titolo = NEW.numero_titolo
      AND sostituisce_polizza IS NULL
      AND COALESCE(polizza_rateo, false) = true
  ) AND EXISTS (
    SELECT 1 FROM public.titoli
    WHERE sostituisce_polizza = NEW.numero_titolo
      AND COALESCE(is_regolazione, false) = false
      AND COALESCE(is_proroga, false) = false
      AND COALESCE(is_appendice_modifica, false) = false
      AND COALESCE(is_oneri_sospensione, false) = false
      AND COALESCE(is_oneri_riattivazione, false) = false
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.garanzia_da IS NOT NULL AND NEW.garanzia_a IS NOT NULL THEN
    v_durata_months := (EXTRACT(YEAR FROM NEW.garanzia_a) - EXTRACT(YEAR FROM NEW.garanzia_da)) * 12
                     + (EXTRACT(MONTH FROM NEW.garanzia_a) - EXTRACT(MONTH FROM NEW.garanzia_da));
    v_is_poliennale := v_durata_months > 13;
  END IF;
  IF v_is_poliennale THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing_id
  FROM public.titoli
  WHERE sostituisce_polizza = NEW.numero_titolo
    AND ((NEW.riga IS NULL AND sostituisce_riga IS NULL) OR sostituisce_riga = NEW.riga)
    AND COALESCE(is_regolazione, false) = false
    AND COALESCE(is_proroga, false) = false
    AND COALESCE(is_appendice_modifica, false) = false
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_frazionamento := COALESCE(NEW.frazionamento, '');
  v_months_period := CASE LOWER(v_frazionamento)
    WHEN 'mensile' THEN 1
    WHEN 'trimestrale' THEN 3
    WHEN 'quadrimestrale' THEN 4
    WHEN 'semestrale' THEN 6
    WHEN 'annuale' THEN 12
    WHEN 'poliennale' THEN 0
    ELSE 0
  END;

  IF v_months_period = 0 THEN
    IF NEW.rate IS NOT NULL AND NEW.rate > 0 THEN
      v_months_period := GREATEST(1, ROUND(12.0 / NEW.rate)::int);
    ELSE
      v_months_period := 12;
    END IF;
  END IF;

  v_new_gar_da := COALESCE(NEW.garanzia_a, NEW.durata_a, NEW.data_scadenza);
  IF v_new_gar_da IS NULL THEN
    RETURN NEW;
  END IF;
  v_new_gar_a := (v_new_gar_da + (v_months_period || ' months')::interval)::date;

  -- Rata con quella garanzia (o successiva) già presente nella catena.
  IF EXISTS (
    SELECT 1 FROM public.titoli
    WHERE sostituisce_polizza = NEW.numero_titolo
      AND compagnia_id IS NOT DISTINCT FROM NEW.compagnia_id
      AND garanzia_da >= v_new_gar_da - 3
      AND COALESCE(is_regolazione, false) = false
      AND COALESCE(is_proroga, false) = false
      AND COALESCE(is_appendice_modifica, false) = false
      AND COALESCE(is_oneri_sospensione, false) = false
      AND COALESCE(is_oneri_riattivazione, false) = false
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(m.durata_a, m.garanzia_a)
    INTO v_madre_durata_a
  FROM public.titoli m
  WHERE m.numero_titolo = NEW.numero_titolo
    AND m.sostituisce_polizza IS NULL
    AND COALESCE(m.is_regolazione, false) = false
    AND COALESCE(m.is_proroga, false) = false
    AND COALESCE(m.is_appendice_modifica, false) = false
  ORDER BY m.riga NULLS FIRST
  LIMIT 1;
  IF v_madre_durata_a IS NULL THEN
    v_madre_durata_a := COALESCE(NEW.durata_a, NEW.garanzia_a);
  END IF;

  IF v_madre_durata_a IS NOT NULL AND v_new_gar_da >= v_madre_durata_a - 28 THEN
    RETURN NEW;
  END IF;
  IF v_madre_durata_a IS NOT NULL AND v_new_gar_a > v_madre_durata_a THEN
    v_new_gar_a := v_madre_durata_a;
  END IF;
  v_new_da := v_new_gar_da;
  v_new_a := v_new_gar_a;

  SELECT COALESCE(MAX(riga), 0) + 1 INTO v_new_riga
  FROM public.titoli
  WHERE numero_titolo = NEW.numero_titolo
    AND COALESCE(is_regolazione, false) = false
    AND COALESCE(is_proroga, false) = false
    AND COALESCE(is_appendice_modifica, false) = false;

  INSERT INTO public.titoli (
    numero_titolo, riga, stato,
    cliente_id, cliente_anagrafica_id,
    prodotto_id, prodotto_nome,
    ufficio_id, produttore_id, produttore_nome,
    compagnia_id, compagnia_rapporto_id, codice_rapporto,
    ramo_id, specialist,
    commerciale_id, anagrafica_commerciale_id,
    percentuale_commerciale, percentuale_riparto, tipo_mandatario,
    ae_anagrafica_id, ae_nome,
    anni_durata, rate, periodicita, frazionamento,
    tipo_rinnovo, tacito_rinnovo, disdetta_giorni,
    descrizione_polizza, targa_telaio, risk_type,
    valuta, cambio, indicizzata, no_calcolo_tasse,
    durata_da, durata_a, data_scadenza, data_competenza,
    garanzia_da, garanzia_a,
    premio_netto, tasse, ssn_firma, addizionali, provvigioni_firma,
    premio_netto_quietanza, tasse_quietanza, ssn_quietanza, addizionali_quietanza, provvigioni_quietanza,
    premio_lordo,
    sostituisce_polizza, sostituisce_riga,
    tipo_portafoglio
  ) VALUES (
    NEW.numero_titolo, v_new_riga, 'attivo',
    NEW.cliente_id, NEW.cliente_anagrafica_id,
    NEW.prodotto_id, NEW.prodotto_nome,
    NEW.ufficio_id, NEW.produttore_id, NEW.produttore_nome,
    NEW.compagnia_id, NEW.compagnia_rapporto_id, NEW.codice_rapporto,
    NEW.ramo_id, NEW.specialist,
    NEW.commerciale_id, NEW.anagrafica_commerciale_id,
    NEW.percentuale_commerciale, NEW.percentuale_riparto, NEW.tipo_mandatario,
    NEW.ae_anagrafica_id, NEW.ae_nome,
    NEW.anni_durata, NEW.rate, NEW.periodicita, NEW.frazionamento,
    NEW.tipo_rinnovo, NEW.tacito_rinnovo, NEW.disdetta_giorni,
    NEW.descrizione_polizza, NEW.targa_telaio, NEW.risk_type,
    NEW.valuta, NEW.cambio, NEW.indicizzata, NEW.no_calcolo_tasse,
    v_new_da, v_new_a, v_new_gar_a, v_new_gar_da,
    v_new_gar_da, v_new_gar_a,
    COALESCE(NEW.premio_netto_quietanza, NEW.premio_netto),
    COALESCE(NEW.tasse_quietanza, NEW.tasse),
    COALESCE(NEW.ssn_quietanza, NEW.ssn_firma),
    COALESCE(NEW.addizionali_quietanza, NEW.addizionali),
    COALESCE(NEW.provvigioni_quietanza, NEW.provvigioni_firma),
    COALESCE(NEW.premio_netto_quietanza, NEW.premio_netto),
    COALESCE(NEW.tasse_quietanza, NEW.tasse),
    COALESCE(NEW.ssn_quietanza, NEW.ssn_firma),
    COALESCE(NEW.addizionali_quietanza, NEW.addizionali),
    COALESCE(NEW.provvigioni_quietanza, NEW.provvigioni_firma),
    NEW.premio_lordo,
    NEW.numero_titolo, NEW.riga,
    NEW.tipo_portafoglio
  ) RETURNING id INTO v_new_id;

  RETURN NEW;
END;
$function$;
