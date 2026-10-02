-- Quietanzamento progressivo:
-- la polizza è la prima rata; ogni incasso completo garantisce UNA sola rata
-- immediatamente successiva. Le catene storiche già pregenerate restano valide.

-- Ripristina il valore già introdotto nel 2026 ma assente dal vincolo del
-- database corrente: senza questo allineamento la relativa regola non è usabile.
ALTER TABLE public.titoli DROP CONSTRAINT IF EXISTS titoli_frazionamento_check;
ALTER TABLE public.titoli ADD CONSTRAINT titoli_frazionamento_check
  CHECK (frazionamento IS NULL OR frazionamento IN (
    'Mensile', 'Trimestrale', 'Quadrimestrale', 'Semestrale', 'Annuale',
    'Poliennale', 'Rata unica', 'Premio unico anticipato'
  ));

CREATE OR REPLACE FUNCTION public.genera_quietanze_su_insert_madre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Dal 02/10/2026 le rate successive non si pregenerano più all'inserimento.
  -- Vengono create una alla volta da genera_quietanza_su_messa_cassa().
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.genera_quietanze_su_insert_madre() IS
'Non pregenera quietanze. La polizza è la prima rata; le successive vengono create una alla volta dopo ogni incasso completo.';

CREATE OR REPLACE FUNCTION public.genera_quietanza_su_messa_cassa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_months_period integer;
  v_frazionamento text;
  v_frazionamento_madre text;
  v_temporanea boolean := false;
  v_rateo boolean := false;
  v_premio_unico_anticipato boolean := false;
  v_new_gar_da date;
  v_new_gar_a date;
  v_new_riga integer;
  v_polizza_id uuid;
  v_madre_durata_a date;
  v_new_id uuid;
BEGIN
  -- Solo il passaggio effettivo a incassato; niente incassi parziali o reincassi.
  IF NEW.stato <> 'incassato' OR OLD.stato = 'incassato' THEN
    RETURN NEW;
  END IF;

  -- Appendici, regolazioni, proroghe e oneri restano titoli one-shot.
  IF COALESCE(NEW.is_regolazione, false)
     OR COALESCE(NEW.is_proroga, false)
     OR COALESCE(NEW.is_appendice_modifica, false)
     OR COALESCE(NEW.is_oneri_sospensione, false)
     OR COALESCE(NEW.is_oneri_riattivazione, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.numero_titolo IS NULL THEN
    RETURN NEW;
  END IF;

  -- Recupera le regole dalla polizza madre senza confondere omonimie di numero.
  SELECT
    COALESCE(m.polizza_temporanea, false),
    COALESCE(m.polizza_rateo, false),
    LOWER(TRIM(COALESCE(m.frazionamento, ''))),
    m.polizza_id,
    COALESCE(m.durata_a, m.garanzia_a)
  INTO
    v_temporanea,
    v_rateo,
    v_frazionamento_madre,
    v_polizza_id,
    v_madre_durata_a
  FROM public.titoli m
  WHERE m.numero_titolo = NEW.numero_titolo
    AND m.sostituisce_polizza IS NULL
    AND m.compagnia_id IS NOT DISTINCT FROM NEW.compagnia_id
    AND COALESCE(m.cliente_anagrafica_id, m.cliente_id)
        IS NOT DISTINCT FROM COALESCE(NEW.cliente_anagrafica_id, NEW.cliente_id)
    AND NOT COALESCE(m.is_regolazione, false)
    AND NOT COALESCE(m.is_proroga, false)
    AND NOT COALESCE(m.is_appendice_modifica, false)
  ORDER BY m.riga NULLS FIRST, m.created_at
  LIMIT 1;

  v_temporanea := COALESCE(v_temporanea, NEW.polizza_temporanea, false);
  v_rateo := COALESCE(v_rateo, NEW.polizza_rateo, false);
  v_frazionamento := LOWER(TRIM(COALESCE(
    NULLIF(NEW.frazionamento, ''),
    v_frazionamento_madre,
    ''
  )));
  v_polizza_id := COALESCE(NEW.polizza_id, v_polizza_id);

  -- Regole storiche da preservare.
  IF v_temporanea OR v_frazionamento IN ('rata unica', 'unica') THEN
    RETURN NEW;
  END IF;

  v_premio_unico_anticipato := v_frazionamento = 'premio unico anticipato';

  -- Serializza due incassi contemporanei sulla stessa catena.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      UPPER(TRIM(NEW.numero_titolo))
      || ':' || COALESCE(NEW.compagnia_id::text, '')
      || ':' || COALESCE(NEW.cliente_anagrafica_id::text, NEW.cliente_id::text, ''),
      0
    )
  );

  IF v_premio_unico_anticipato THEN
    -- Dopo la polizza crea solo il titolo tecnico del giorno finale.
    IF NEW.sostituisce_polizza IS NOT NULL THEN
      RETURN NEW;
    END IF;
    v_new_gar_da := COALESCE(v_madre_durata_a, NEW.durata_a, NEW.garanzia_a);
    v_new_gar_a := v_new_gar_da;
  ELSE
    v_months_period := CASE v_frazionamento
      WHEN 'mensile' THEN 1
      WHEN 'trimestrale' THEN 3
      WHEN 'quadrimestrale' THEN 4
      WHEN 'semestrale' THEN 6
      WHEN 'annuale' THEN 12
      WHEN 'poliennale' THEN 12
      ELSE 0
    END;

    IF v_months_period = 0 THEN
      IF NEW.rate IS NOT NULL AND NEW.rate > 0 THEN
        v_months_period := GREATEST(1, ROUND(12.0 / NEW.rate)::integer);
      ELSE
        v_months_period := 12;
      END IF;
    END IF;

    -- Stesso giorno di confine: la nuova rata parte quando termina la precedente.
    v_new_gar_da := COALESCE(NEW.garanzia_a, NEW.durata_a, NEW.data_scadenza);
    IF v_new_gar_da IS NULL THEN
      RETURN NEW;
    END IF;
    v_new_gar_a := (v_new_gar_da + (v_months_period || ' months')::interval)::date;
  END IF;

  -- Una rata diretta o dello stesso periodo esiste già: non duplicarla.
  IF EXISTS (
    SELECT 1
    FROM public.titoli t
    WHERE t.id <> NEW.id
      AND t.numero_titolo = NEW.numero_titolo
      AND t.compagnia_id IS NOT DISTINCT FROM NEW.compagnia_id
      AND COALESCE(t.cliente_anagrafica_id, t.cliente_id)
          IS NOT DISTINCT FROM COALESCE(NEW.cliente_anagrafica_id, NEW.cliente_id)
      AND t.sostituisce_polizza = NEW.numero_titolo
      AND COALESCE(t.premio_lordo, 0) >= 0
      AND NOT COALESCE(t.is_regolazione, false)
      AND NOT COALESCE(t.is_proroga, false)
      AND NOT COALESCE(t.is_appendice_modifica, false)
      AND NOT COALESCE(t.is_oneri_sospensione, false)
      AND NOT COALESCE(t.is_oneri_riattivazione, false)
      AND (
        t.sostituisce_riga IS NOT DISTINCT FROM NEW.riga
        OR (
          t.garanzia_da BETWEEN v_new_gar_da - 3 AND v_new_gar_da + 3
          AND t.garanzia_a BETWEEN v_new_gar_a - 3 AND v_new_gar_a + 3
        )
      )
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(t.riga), 0) + 1
  INTO v_new_riga
  FROM public.titoli t
  WHERE t.numero_titolo = NEW.numero_titolo
    AND t.compagnia_id IS NOT DISTINCT FROM NEW.compagnia_id
    AND COALESCE(t.cliente_anagrafica_id, t.cliente_id)
        IS NOT DISTINCT FROM COALESCE(NEW.cliente_anagrafica_id, NEW.cliente_id)
    AND NOT COALESCE(t.is_regolazione, false)
    AND NOT COALESCE(t.is_proroga, false)
    AND NOT COALESCE(t.is_appendice_modifica, false);

  INSERT INTO public.titoli (
    numero_titolo, riga, stato,
    cliente_id, cliente_anagrafica_id,
    prodotto_id, prodotto_nome,
    ufficio_id, filiale, produttore_id, produttore_nome,
    compagnia_id, compagnia_rapporto_id, codice_rapporto,
    ramo_id, specialist,
    commerciale_id, anagrafica_commerciale_id,
    percentuale_commerciale, percentuale_riparto, tipo_mandatario,
    ae_anagrafica_id, ae_nome, percentuale_ae,
    anni_durata, rate, periodicita, frazionamento,
    tipo_rinnovo, tacito_rinnovo, disdetta_giorni, riforma_alla_scadenza,
    descrizione_polizza, targa_telaio, risk_type,
    valuta, cambio, indicizzata, no_calcolo_tasse,
    cig_rif, cig_temporaneo, coassicurazione, pag_diretto_compagnia,
    durata_da, durata_a, data_scadenza, data_competenza,
    garanzia_da, garanzia_a,
    premio_netto, tasse, ssn_firma, addizionali, provvigioni_firma,
    premio_netto_quietanza, tasse_quietanza, ssn_quietanza,
    addizionali_quietanza, provvigioni_quietanza,
    brokeraggio_firma, brokeraggio_quietanza, percentuale_brokeraggio,
    premio_lordo,
    polizza_id, sostituisce_polizza, sostituisce_riga,
    tipo_portafoglio, polizza_temporanea, polizza_rateo,
    note
  ) VALUES (
    NEW.numero_titolo, v_new_riga, 'attivo',
    NEW.cliente_id, NEW.cliente_anagrafica_id,
    NEW.prodotto_id, NEW.prodotto_nome,
    NEW.ufficio_id, NEW.filiale, NEW.produttore_id, NEW.produttore_nome,
    NEW.compagnia_id, NEW.compagnia_rapporto_id, NEW.codice_rapporto,
    NEW.ramo_id, NEW.specialist,
    NEW.commerciale_id, NEW.anagrafica_commerciale_id,
    NEW.percentuale_commerciale, NEW.percentuale_riparto, NEW.tipo_mandatario,
    NEW.ae_anagrafica_id, NEW.ae_nome, NEW.percentuale_ae,
    NEW.anni_durata, NEW.rate, NEW.periodicita, NEW.frazionamento,
    NEW.tipo_rinnovo, NEW.tacito_rinnovo, NEW.disdetta_giorni, NEW.riforma_alla_scadenza,
    NEW.descrizione_polizza, NEW.targa_telaio, NEW.risk_type,
    NEW.valuta, NEW.cambio, NEW.indicizzata, NEW.no_calcolo_tasse,
    NEW.cig_rif, NEW.cig_temporaneo, NEW.coassicurazione, NEW.pag_diretto_compagnia,
    v_new_gar_da, v_new_gar_a, v_new_gar_a, v_new_gar_da,
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
    COALESCE(NEW.brokeraggio_quietanza, NEW.brokeraggio_firma),
    COALESCE(NEW.brokeraggio_quietanza, NEW.brokeraggio_firma),
    NEW.percentuale_brokeraggio,
    NEW.premio_lordo,
    v_polizza_id, NEW.numero_titolo, NEW.riga,
    NEW.tipo_portafoglio, false, v_rateo,
    CASE
      WHEN POSITION(
        'Quietanza successiva generata automaticamente all''incasso'
        IN COALESCE(NEW.note, '')
      ) > 0 THEN NEW.note
      ELSE concat_ws(
        E'\n',
        NULLIF(NEW.note, ''),
        'Quietanza successiva generata automaticamente all''incasso'
      )
    END
  )
  RETURNING id INTO v_new_id;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.genera_quietanza_su_messa_cassa() IS
'Genera una sola quietanza immediatamente successiva a ogni incasso completo. Prosegue oltre l''annualità, riusa quietanze già presenti e preserva le esclusioni temporanea/rata unica/appendici/regolazioni/proroghe.';

DROP TRIGGER IF EXISTS trg_genera_quietanza_su_messa_cassa ON public.titoli;
CREATE TRIGGER trg_genera_quietanza_su_messa_cassa
AFTER UPDATE OF stato ON public.titoli
FOR EACH ROW
EXECUTE FUNCTION public.genera_quietanza_su_messa_cassa();
