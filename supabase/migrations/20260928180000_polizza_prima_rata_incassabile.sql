-- Rivoluzione polizza/quietanza:
-- la prima riga inserita È la polizza incassabile; si generano solo le rate successive.
-- Cambio numero su una quietanza: quella riga diventa polizza (stacco).
-- Aggiorna genera_quietanze_su_insert_madre (solo rate successive)
-- + trigger stacco numero. Lo storico è in 20260928181000.

CREATE OR REPLACE FUNCTION public.genera_quietanze_su_insert_madre()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_months_period int;
  v_anni int;
  v_n_rate int;
  v_i int;
  v_frazionamento text;
  v_prev_riga int := COALESCE(NEW.riga, 1);
  v_gar_da date; v_gar_a date;
  v_dur_da date; v_dur_a date;
  v_competenza date; v_scadenza date;
  v_new_id uuid; v_new_riga int;
  v_temporanea boolean := COALESCE(NEW.polizza_temporanea, false);
  v_rateo boolean := COALESCE(NEW.polizza_rateo, false);
  v_durata_fine date;
  v_premio_lordo_f numeric;
  v_premio_lordo_q numeric;
BEGIN
  IF NEW.sostituisce_polizza IS NOT NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.is_regolazione, false) THEN RETURN NEW; END IF;
  IF COALESCE(NEW.is_appendice_modifica, false) OR COALESCE(NEW.is_proroga, false) THEN RETURN NEW; END IF;
  IF NEW.numero_titolo IS NULL THEN RETURN NEW; END IF;
  IF NEW.garanzia_da IS NULL OR NEW.garanzia_a IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.titoli
     WHERE sostituisce_polizza = NEW.numero_titolo
       AND COALESCE(is_regolazione, false) = false
  ) THEN RETURN NEW; END IF;

  IF v_temporanea THEN
    -- La polizza inserita È il titolo incassabile (nessuna quietanza clone).
    RETURN NEW;
  END IF;

  v_frazionamento := COALESCE(NEW.frazionamento, '');

  -- Rata unica / legacy Unica: la polizza è l'unico titolo incassabile.
  IF LOWER(TRIM(v_frazionamento)) IN ('rata unica', 'unica') THEN
    RETURN NEW;
  END IF;

  v_months_period := CASE LOWER(v_frazionamento)
    WHEN 'mensile' THEN 1 WHEN 'trimestrale' THEN 3 WHEN 'quadrimestrale' THEN 4
    WHEN 'semestrale' THEN 6 WHEN 'annuale' THEN 12 WHEN 'poliennale' THEN 12
    ELSE 0 END;

  IF v_rateo THEN
    IF v_months_period = 0 THEN RETURN NEW; END IF;
    v_durata_fine := COALESCE(NEW.durata_a, NEW.garanzia_a);
    v_dur_da := COALESCE(NEW.durata_da, NEW.garanzia_da);
    v_dur_a := v_durata_fine;
    v_gar_da := NEW.garanzia_da;
    v_gar_a := NEW.garanzia_a;
    v_competenza := COALESCE(NEW.data_competenza, NEW.garanzia_da);
    v_scadenza := COALESCE(NEW.data_scadenza, v_gar_a);
    v_premio_lordo_q := COALESCE(NEW.premio_netto_quietanza, NEW.premio_netto, 0) + COALESCE(NEW.tasse_quietanza, NEW.tasse, 0) + COALESCE(NEW.addizionali_quietanza, NEW.addizionali, 0) + COALESCE(NEW.ssn_quietanza, NEW.ssn_firma, 0);
    v_gar_da := NEW.garanzia_a;
    WHILE v_gar_da < v_durata_fine LOOP
      v_gar_a := (v_gar_da + (v_months_period || ' months')::interval)::date;
      IF v_gar_a > v_durata_fine THEN v_gar_a := v_durata_fine; END IF;
      v_competenza := v_gar_da;
      v_scadenza := v_gar_a;
      v_new_riga := v_prev_riga + 1;
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
        tipo_portafoglio,
        polizza_temporanea, polizza_rateo
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
        v_dur_da, v_dur_a, v_scadenza, v_competenza,
        v_gar_da, v_gar_a,
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
        v_premio_lordo_q,
        NEW.numero_titolo, v_prev_riga,
        NEW.tipo_portafoglio,
        false, true
      ) RETURNING id INTO v_new_id;
      EXIT WHEN v_gar_a >= v_durata_fine;
      v_gar_da := v_gar_a;
      v_prev_riga := v_new_riga;
    END LOOP;
    RETURN NEW;
  END IF;

  IF LOWER(TRIM(v_frazionamento)) = 'premio unico anticipato' THEN
    v_dur_da := COALESCE(NEW.durata_da, NEW.garanzia_da);
    v_dur_a := COALESCE(NEW.durata_a, NEW.garanzia_a);
    v_competenza := COALESCE(NEW.data_competenza, v_dur_da);
    v_scadenza := COALESCE(NEW.data_scadenza, v_dur_a);

    -- Periodo 1 = polizza (madre). Solo il giorno tecnico finale è quietanza.
    v_gar_da := v_dur_a;
    v_gar_a := v_dur_a;
    FOR v_i IN 2..2 LOOP

      v_new_riga := v_prev_riga + 1;
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
        tipo_portafoglio,
        polizza_temporanea, polizza_rateo
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
        v_dur_da, v_dur_a, v_scadenza, v_competenza,
        v_gar_da, v_gar_a,
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
        NEW.numero_titolo, v_prev_riga,
        NEW.tipo_portafoglio,
        false, false
      ) RETURNING id INTO v_new_id;
      v_prev_riga := v_new_riga;
    END LOOP;

    RETURN NEW;
  END IF;

  IF v_months_period = 0 THEN RETURN NEW; END IF;

  v_anni := GREATEST(1, COALESCE(NEW.anni_durata, 1));
  v_n_rate := (12 / v_months_period) * v_anni;
  IF v_n_rate < 1 THEN RETURN NEW; END IF;

  -- Clip alla durata della madre: non partire una rata a/dopo durata_a
  -- (es. M16850989: 2029-06-30 → 2030-06-30).
  v_durata_fine := NEW.durata_a;

  FOR v_i IN 2..v_n_rate LOOP
    v_gar_da := (NEW.garanzia_da + ((v_i - 1) * v_months_period || ' months')::interval)::date;
    IF v_durata_fine IS NOT NULL AND v_gar_da >= v_durata_fine THEN
      EXIT;
    END IF;
    v_gar_a  := (v_gar_da + (v_months_period || ' months')::interval)::date;
    IF v_durata_fine IS NOT NULL AND v_gar_a > v_durata_fine THEN
      v_gar_a := v_durata_fine;
    END IF;
    IF NEW.durata_da IS NOT NULL THEN
      v_dur_da := (NEW.durata_da + ((v_i - 1) * v_months_period || ' months')::interval)::date;
      v_dur_a  := (v_dur_da + (v_months_period || ' months')::interval)::date;
      IF v_durata_fine IS NOT NULL AND v_dur_a > v_durata_fine THEN
        v_dur_a := v_durata_fine;
      END IF;
    ELSE
      v_dur_da := v_gar_da; v_dur_a := v_gar_a;
    END IF;
    IF NEW.data_competenza IS NOT NULL THEN
      v_competenza := (NEW.data_competenza + ((v_i - 1) * v_months_period || ' months')::interval)::date;
    ELSE v_competenza := v_gar_da; END IF;
    IF NEW.data_scadenza IS NOT NULL THEN
      v_scadenza := (NEW.data_scadenza + ((v_i - 1) * v_months_period || ' months')::interval)::date;
    ELSE v_scadenza := v_dur_a; END IF;
    v_new_riga := v_prev_riga + 1;
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
      tipo_portafoglio,
      polizza_temporanea, polizza_rateo
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
      v_dur_da, v_dur_a, v_scadenza, v_competenza,
      v_gar_da, v_gar_a,
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
      NEW.numero_titolo, v_prev_riga,
      NEW.tipo_portafoglio,
      false, false
    ) RETURNING id INTO v_new_id;
    v_prev_riga := v_new_riga;
  END LOOP;

  RETURN NEW;
END;
$function$;


COMMENT ON FUNCTION public.genera_quietanze_su_insert_madre() IS
'Pre-genera solo le quietanze SUCCESSIVE. La riga inserita è la polizza (prima rata incassabile). Temporanea/Rata unica: nessuna quietanza extra. Rateo: solo periodi dopo la firma. Premio unico anticipato: solo il giorno tecnico finale. Standard: FOR i IN 2..n, clip a durata_a.';


CREATE OR REPLACE FUNCTION public.trg_titoli_cambio_numero_quietanza_diventa_polizza()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF OLD.sostituisce_polizza IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.numero_titolo IS NOT DISTINCT FROM OLD.numero_titolo THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.is_appendice_modifica, false)
     OR COALESCE(NEW.is_proroga, false)
     OR COALESCE(NEW.is_regolazione, false) THEN
    RETURN NEW;
  END IF;
  -- Rinomina catena: numero e sostituisce restano allineati → non staccare.
  IF NEW.sostituisce_polizza IS NOT NULL
     AND NEW.numero_titolo IS NOT DISTINCT FROM NEW.sostituisce_polizza THEN
    RETURN NEW;
  END IF;
  NEW.sostituisce_polizza := NULL;
  NEW.sostituisce_riga := NULL;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_titoli_cambio_numero_quietanza_diventa_polizza ON public.titoli;
CREATE TRIGGER trg_titoli_cambio_numero_quietanza_diventa_polizza
  BEFORE UPDATE OF numero_titolo ON public.titoli
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_titoli_cambio_numero_quietanza_diventa_polizza();

COMMENT ON FUNCTION public.trg_titoli_cambio_numero_quietanza_diventa_polizza() IS
  'Se cambia numero_titolo su una quietanza (e non è un rename-catena), la riga diventa polizza.';

-- La polizza è la prima rata incassabile: può avere data_copertura.
DROP TRIGGER IF EXISTS trg_titoli_no_copertura_madre ON public.titoli;
DROP TRIGGER IF EXISTS trg_clear_madre_copertura_after_quietanza ON public.titoli;

CREATE OR REPLACE FUNCTION public.enforce_no_copertura_polizza_madre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_data_copertura_polizza_madre(p_titolo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN;
END;
$$;
