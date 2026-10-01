-- Una scheda anagrafica professionale può avere più ruoli (produttore, AE,
-- responsabile di sede, ...). `tipo` resta il ruolo principale, `ruoli` li
-- contiene tutti (tipo compreso).
-- Provvigioni: se la stessa scheda è produttore e AE sulla stessa polizza
-- vince il produttore (la quota AE non si genera e resta a Consulbrokers).

ALTER TABLE public.anagrafiche_professionali
  ADD COLUMN IF NOT EXISTS ruoli text[] NOT NULL DEFAULT '{}';

UPDATE public.anagrafiche_professionali
   SET ruoli = ARRAY[tipo]
 WHERE ruoli = '{}' OR NOT (tipo = ANY (ruoli));

CREATE INDEX IF NOT EXISTS idx_anagrafiche_prof_ruoli
  ON public.anagrafiche_professionali USING gin (ruoli);

CREATE OR REPLACE FUNCTION public.validate_anagrafiche_professionali_tipo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_ammessi constant text[] := ARRAY['liquidatore','perito','legale','account_executive','corrispondente','executive','responsabile_sede','produttore_sede'];
  v_r text;
BEGIN
  IF NEW.tipo IS NULL OR NOT (NEW.tipo = ANY (v_ammessi)) THEN
    RAISE EXCEPTION 'Invalid tipo: %', NEW.tipo;
  END IF;
  FOREACH v_r IN ARRAY COALESCE(NEW.ruoli, '{}') LOOP
    IF NOT (v_r = ANY (v_ammessi)) THEN
      RAISE EXCEPTION 'Ruolo non valido: %', v_r;
    END IF;
  END LOOP;
  -- tipo sempre primo; nessun duplicato
  NEW.ruoli := ARRAY(
    SELECT r FROM (
      SELECT r, min(o) AS o
        FROM unnest(ARRAY[NEW.tipo] || COALESCE(NEW.ruoli, '{}')) WITH ORDINALITY AS u(r, o)
       GROUP BY r
    ) x ORDER BY o
  );
  RETURN NEW;
END;
$function$;

-- Unisce la scheda p_dup nella scheda p_master: completa i dati mancanti,
-- somma i ruoli, ripunta polizze/split/provvigioni e archivia il doppione
-- (attivo=false + nota). Non cancella nulla.
CREATE OR REPLACE FUNCTION public.unisci_anagrafiche_professionali(p_master uuid, p_dup uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  d record;
  v_titoli int := 0;
  v_split int := 0;
  v_txt text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Permesso negato: solo admin';
  END IF;
  IF p_master IS NULL OR p_dup IS NULL OR p_master = p_dup THEN
    RAISE EXCEPTION 'Schede da unire non valide';
  END IF;

  SELECT * INTO m FROM public.anagrafiche_professionali WHERE id = p_master FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Scheda principale non trovata'; END IF;
  SELECT * INTO d FROM public.anagrafiche_professionali WHERE id = p_dup FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Scheda da unire non trovata'; END IF;

  IF NULLIF(upper(btrim(m.codice_fiscale)), '') IS NOT NULL
     AND NULLIF(upper(btrim(d.codice_fiscale)), '') IS NOT NULL
     AND upper(btrim(m.codice_fiscale)) <> upper(btrim(d.codice_fiscale)) THEN
    RAISE EXCEPTION 'Codici fiscali diversi (% / %): non sono la stessa persona', m.codice_fiscale, d.codice_fiscale;
  END IF;

  PERFORM set_config('app.bypass_messa_cassa_lock', 'on', true);
  PERFORM set_config('app.bypass_premi_lock', 'on', true);

  UPDATE public.anagrafiche_professionali x SET
    ruoli = m.ruoli || d.ruoli,
    attivo = COALESCE(m.attivo, false) OR COALESCE(d.attivo, false),
    nome = COALESCE(NULLIF(btrim(m.nome), ''), NULLIF(btrim(d.nome), '')),
    cognome = COALESCE(NULLIF(btrim(m.cognome), ''), NULLIF(btrim(d.cognome), '')),
    ragione_sociale = COALESCE(NULLIF(btrim(m.ragione_sociale), ''), NULLIF(btrim(d.ragione_sociale), '')),
    codice_fiscale = COALESCE(NULLIF(btrim(m.codice_fiscale), ''), NULLIF(btrim(d.codice_fiscale), '')),
    partita_iva = COALESCE(NULLIF(btrim(m.partita_iva), ''), NULLIF(btrim(d.partita_iva), '')),
    email = COALESCE(NULLIF(btrim(m.email), ''), NULLIF(btrim(d.email), '')),
    pec = COALESCE(NULLIF(btrim(m.pec), ''), NULLIF(btrim(d.pec), '')),
    telefono = COALESCE(NULLIF(btrim(m.telefono), ''), NULLIF(btrim(d.telefono), '')),
    cellulare = COALESCE(NULLIF(btrim(m.cellulare), ''), NULLIF(btrim(d.cellulare), '')),
    fax = COALESCE(NULLIF(btrim(m.fax), ''), NULLIF(btrim(d.fax), '')),
    indirizzo = COALESCE(NULLIF(btrim(m.indirizzo), ''), NULLIF(btrim(d.indirizzo), '')),
    cap = COALESCE(NULLIF(btrim(m.cap), ''), NULLIF(btrim(d.cap), '')),
    citta = COALESCE(NULLIF(btrim(m.citta), ''), NULLIF(btrim(d.citta), '')),
    provincia = COALESCE(NULLIF(btrim(m.provincia), ''), NULLIF(btrim(d.provincia), '')),
    nome_breve = COALESCE(NULLIF(btrim(m.nome_breve), ''), NULLIF(btrim(d.nome_breve), '')),
    sigla = COALESCE(NULLIF(btrim(m.sigla), ''), NULLIF(btrim(d.sigla), '')),
    banca_riga1 = COALESCE(NULLIF(btrim(m.banca_riga1), ''), NULLIF(btrim(d.banca_riga1), '')),
    banca_riga2 = COALESCE(NULLIF(btrim(m.banca_riga2), ''), NULLIF(btrim(d.banca_riga2), '')),
    banca_riga3 = COALESCE(NULLIF(btrim(m.banca_riga3), ''), NULLIF(btrim(d.banca_riga3), '')),
    nome_rui = COALESCE(NULLIF(btrim(m.nome_rui), ''), NULLIF(btrim(d.nome_rui), '')),
    iscrizione_rui = COALESCE(NULLIF(btrim(m.iscrizione_rui), ''), NULLIF(btrim(d.iscrizione_rui), '')),
    numero_rui = COALESCE(NULLIF(btrim(m.numero_rui), ''), NULLIF(btrim(d.numero_rui), '')),
    sezione_rui = COALESCE(NULLIF(btrim(m.sezione_rui), ''), NULLIF(btrim(d.sezione_rui), '')),
    data_iscrizione_rui = COALESCE(m.data_iscrizione_rui, d.data_iscrizione_rui),
    codice_fornitore = COALESCE(NULLIF(btrim(m.codice_fornitore), ''), NULLIF(btrim(d.codice_fornitore), '')),
    abi = COALESCE(NULLIF(btrim(m.abi), ''), NULLIF(btrim(d.abi), '')),
    cab = COALESCE(NULLIF(btrim(m.cab), ''), NULLIF(btrim(d.cab), '')),
    iban = COALESCE(NULLIF(btrim(m.iban), ''), NULLIF(btrim(d.iban), '')),
    intestatario_cc = COALESCE(NULLIF(btrim(m.intestatario_cc), ''), NULLIF(btrim(d.intestatario_cc), '')),
    -- percentuali: vince la scheda principale (produttore), il doppione solo se mancano
    percentuale_base = CASE WHEN COALESCE(m.percentuale_base, 0) > 0 THEN m.percentuale_base ELSE COALESCE(NULLIF(d.percentuale_base, 0), m.percentuale_base) END,
    percentuale_consulenza = CASE WHEN COALESCE(m.percentuale_consulenza, 0) > 0 THEN m.percentuale_consulenza ELSE COALESCE(NULLIF(d.percentuale_consulenza, 0), m.percentuale_consulenza) END,
    percentuale_ra = COALESCE(m.percentuale_ra, d.percentuale_ra),
    trattenuta_provvigioni_incasso = COALESCE(m.trattenuta_provvigioni_incasso, false) OR COALESCE(d.trattenuta_provvigioni_incasso, false),
    ufficio_id = COALESCE(m.ufficio_id, d.ufficio_id),
    note = NULLIF(btrim(concat_ws(E'\n', NULLIF(btrim(m.note), ''),
      format('Unita la scheda %s (%s%s) il %s.', d.id, d.tipo,
             CASE WHEN NULLIF(btrim(d.codice), '') IS NOT NULL THEN ', codice ' || d.codice ELSE '' END,
             to_char(current_date, 'DD/MM/YYYY')))), '')
  WHERE x.id = p_master;

  UPDATE public.titoli SET anagrafica_commerciale_id = p_master WHERE anagrafica_commerciale_id = p_dup;
  GET DIAGNOSTICS v_titoli = ROW_COUNT;
  UPDATE public.titoli SET ae_anagrafica_id = p_master WHERE ae_anagrafica_id = p_dup;

  -- split: se sulla stessa polizza ci sono entrambe, si sommano sulla principale
  WITH dup_rows AS (
    DELETE FROM public.titoli_split_commerciali s
     WHERE s.anagrafica_commerciale_id = p_dup
       AND EXISTS (SELECT 1 FROM public.titoli_split_commerciali s2
                    WHERE s2.titolo_id = s.titolo_id AND s2.anagrafica_commerciale_id = p_master)
    RETURNING s.titolo_id, s.percentuale
  )
  UPDATE public.titoli_split_commerciali s
     SET percentuale = s.percentuale + r.percentuale
    FROM (SELECT titolo_id, sum(percentuale) AS percentuale FROM dup_rows GROUP BY titolo_id) r
   WHERE s.titolo_id = r.titolo_id AND s.anagrafica_commerciale_id = p_master;
  UPDATE public.titoli_split_commerciali SET anagrafica_commerciale_id = p_master WHERE anagrafica_commerciale_id = p_dup;
  GET DIAGNOSTICS v_split = ROW_COUNT;

  UPDATE public.titoli_modalita_incasso SET anagrafica_commerciale_id = p_master WHERE anagrafica_commerciale_id = p_dup;
  UPDATE public.provvigioni_generate SET anagrafica_commerciale_id = p_master WHERE anagrafica_commerciale_id = p_dup;

  DELETE FROM public.clienti_intermediari_default c
   WHERE c.anagrafica_commerciale_id = p_dup
     AND EXISTS (SELECT 1 FROM public.clienti_intermediari_default c2
                  WHERE c2.cliente_id = c.cliente_id AND c2.tipo = c.tipo AND c2.anagrafica_commerciale_id = p_master);
  UPDATE public.clienti_intermediari_default SET anagrafica_commerciale_id = p_master WHERE anagrafica_commerciale_id = p_dup;

  UPDATE public.codici_commerciali_cliente SET anagrafica_id = p_master WHERE anagrafica_id = p_dup;

  DELETE FROM public.produttori_provvigioni_ramo p
   WHERE p.anagrafica_id = p_dup
     AND EXISTS (SELECT 1 FROM public.produttori_provvigioni_ramo p2
                  WHERE p2.anagrafica_id = p_master AND p2.ramo_codice = p.ramo_codice);
  UPDATE public.produttori_provvigioni_ramo SET anagrafica_id = p_master WHERE anagrafica_id = p_dup;

  UPDATE public.polizze SET anagrafica_commerciale_id = p_master WHERE anagrafica_commerciale_id = p_dup;
  UPDATE public.polizze SET produttore_anagrafica_id = p_master WHERE produttore_anagrafica_id = p_dup;
  UPDATE public.polizze SET account_executive_anagrafica_id = p_master WHERE account_executive_anagrafica_id = p_dup;
  UPDATE public.fornitori SET anagrafica_professionale_id = p_master WHERE anagrafica_professionale_id = p_dup;
  UPDATE public.documenti SET entita_id = p_master
   WHERE entita_tipo = 'anagrafica_professionale' AND entita_id = p_dup;

  v_txt := format('Unita nella scheda %s il %s. Scheda non cancellata; polizze e provvigioni ripuntate sulla principale.',
                  p_master, to_char(current_date, 'DD/MM/YYYY'));
  UPDATE public.anagrafiche_professionali
     SET attivo = false,
         note = NULLIF(btrim(concat_ws(E'\n', NULLIF(btrim(note), ''), v_txt)), '')
   WHERE id = p_dup;

  RETURN jsonb_build_object('ok', true, 'master', p_master, 'dup', p_dup,
                            'titoli', v_titoli, 'split', v_split);
END;
$function$;

REVOKE ALL ON FUNCTION public.unisci_anagrafiche_professionali(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unisci_anagrafiche_professionali(uuid, uuid) TO authenticated;

-- Generatore SQL delle provvigioni: se l'AE è anche produttore della polizza
-- vince il produttore (nessuna riga 'ae').
CREATE OR REPLACE FUNCTION public.fn_rigenera_provvigioni_generate(p_titolo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_titolo record;
  v_quietanza_id uuid;
  v_admin_anagrafica_id uuid;
  v_totale numeric;
  v_sum_perc numeric := 0;
  v_has_ae boolean;
  v_ae_perc numeric;
  v_perc_admin numeric;
  v_importo numeric;
  v_importo_admin numeric;
  v_admin_comm_importo numeric;
  v_ae_admin_importo numeric;
  v_perc_admin_totale numeric;
  v_importo_admin_totale numeric;
  v_s record;
  v_count int := 0;
  v_prod_ids uuid[] := '{}';
BEGIN
  SELECT t.id, t.stato, t.provvigioni_quietanza, t.percentuale_commerciale,
         t.commerciale_id, t.produttore_id, t.prodotto_id, t.ufficio_id,
         t.anagrafica_commerciale_id, t.ae_anagrafica_id, t.percentuale_ae
    INTO v_titolo
  FROM public.titoli t
  WHERE t.id = p_titolo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Titolo non trovato';
  END IF;

  IF v_titolo.stato <> 'incassato' THEN
    RETURN 0;
  END IF;

  SELECT q.id INTO v_quietanza_id
  FROM public.quietanze q
  WHERE q.titolo_id = p_titolo_id
  LIMIT 1;

  SELECT (s.valore_json ->> 'anagrafica_id')::uuid INTO v_admin_anagrafica_id
  FROM public.impostazioni_sistema s
  WHERE s.chiave = 'admin_anagrafica_id'
  LIMIT 1;

  v_totale := round(COALESCE(v_titolo.provvigioni_quietanza, 0)::numeric, 2);
  IF v_totale <= 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM public.provvigioni_generate
  WHERE titolo_id = p_titolo_id
    AND COALESCE(pagata, false) = false;

  FOR v_s IN
    SELECT anagrafica_commerciale_id, commerciale_user_id, percentuale
    FROM public.titoli_split_commerciali
    WHERE titolo_id = p_titolo_id
    ORDER BY ordine
  LOOP
    v_sum_perc := v_sum_perc + COALESCE(v_s.percentuale, 0);
    IF v_s.anagrafica_commerciale_id IS NOT NULL THEN
      v_prod_ids := v_prod_ids || v_s.anagrafica_commerciale_id;
    END IF;
    v_importo := round((v_totale * COALESCE(v_s.percentuale, 0) / 100)::numeric, 2);
    INSERT INTO public.provvigioni_generate (
      titolo_id, quietanza_id, user_id, anagrafica_commerciale_id,
      percentuale, importo_provvigione, tipo_destinatario, solo_statistico, pagata
    ) VALUES (
      p_titolo_id, v_quietanza_id, v_s.commerciale_user_id, v_s.anagrafica_commerciale_id,
      v_s.percentuale, v_importo, 'commerciale',
      (v_admin_anagrafica_id IS NOT NULL AND v_s.anagrafica_commerciale_id = v_admin_anagrafica_id),
      false
    );
    v_count := v_count + 1;
  END LOOP;

  IF v_sum_perc = 0 AND (v_titolo.anagrafica_commerciale_id IS NOT NULL OR v_titolo.commerciale_id IS NOT NULL) THEN
    v_sum_perc := LEAST(GREATEST(COALESCE(v_titolo.percentuale_commerciale, 100), 0), 100);
    IF v_titolo.anagrafica_commerciale_id IS NOT NULL THEN
      v_prod_ids := v_prod_ids || v_titolo.anagrafica_commerciale_id;
    END IF;
    v_importo := round((v_totale * v_sum_perc / 100)::numeric, 2);
    INSERT INTO public.provvigioni_generate (
      titolo_id, quietanza_id, user_id, anagrafica_commerciale_id,
      percentuale, importo_provvigione, tipo_destinatario, solo_statistico, pagata
    ) VALUES (
      p_titolo_id, v_quietanza_id, v_titolo.commerciale_id, v_titolo.anagrafica_commerciale_id,
      v_sum_perc, v_importo, 'commerciale',
      (v_admin_anagrafica_id IS NOT NULL AND v_titolo.anagrafica_commerciale_id = v_admin_anagrafica_id),
      false
    );
    v_count := v_count + 1;
  END IF;

  v_has_ae := v_titolo.ae_anagrafica_id IS NOT NULL
              AND COALESCE(v_titolo.percentuale_ae, 0) > 0
              AND NOT (v_titolo.ae_anagrafica_id = ANY (v_prod_ids));
  v_ae_perc := CASE WHEN v_has_ae THEN LEAST(GREATEST(v_titolo.percentuale_ae, 0), 100) ELSE 0 END;
  v_perc_admin := GREATEST(0, round((100 - v_sum_perc - CASE WHEN v_has_ae THEN v_ae_perc ELSE 0 END)::numeric, 2));

  IF v_has_ae THEN
    v_importo := round((v_totale * v_ae_perc / 100)::numeric, 2);
    INSERT INTO public.provvigioni_generate (
      titolo_id, quietanza_id, user_id, anagrafica_commerciale_id,
      percentuale, importo_provvigione, tipo_destinatario, solo_statistico, pagata
    ) VALUES (
      p_titolo_id, v_quietanza_id, NULL, v_titolo.ae_anagrafica_id,
      v_ae_perc, v_importo, 'ae',
      (v_admin_anagrafica_id IS NOT NULL AND v_titolo.ae_anagrafica_id = v_admin_anagrafica_id),
      false
    );
    v_count := v_count + 1;
  END IF;

  v_importo_admin := round((v_totale * v_perc_admin / 100)::numeric, 2);
  v_admin_comm_importo := 0;
  v_ae_admin_importo := 0;

  SELECT COALESCE(sum(round((v_totale * percentuale / 100)::numeric, 2)), 0) INTO v_admin_comm_importo
  FROM public.titoli_split_commerciali
  WHERE titolo_id = p_titolo_id
    AND v_admin_anagrafica_id IS NOT NULL
    AND anagrafica_commerciale_id = v_admin_anagrafica_id;

  IF v_has_ae AND v_admin_anagrafica_id IS NOT NULL AND v_titolo.ae_anagrafica_id = v_admin_anagrafica_id THEN
    v_ae_admin_importo := round((v_totale * v_ae_perc / 100)::numeric, 2);
  END IF;

  v_importo_admin_totale := round((v_importo_admin + v_admin_comm_importo + v_ae_admin_importo)::numeric, 2);
  v_perc_admin_totale := v_perc_admin;

  IF v_importo_admin_totale > 0 OR (v_sum_perc = 0 AND NOT v_has_ae) THEN
    INSERT INTO public.provvigioni_generate (
      titolo_id, quietanza_id, user_id, anagrafica_commerciale_id,
      percentuale, importo_provvigione, tipo_destinatario, solo_statistico, pagata
    ) VALUES (
      p_titolo_id, v_quietanza_id, NULL, NULL,
      CASE WHEN v_sum_perc = 0 AND NOT v_has_ae THEN 100 ELSE v_perc_admin_totale END,
      CASE WHEN v_sum_perc = 0 AND NOT v_has_ae THEN v_totale ELSE v_importo_admin_totale END,
      'admin', false, false
    );
    v_count := v_count + 1;
  END IF;

  RETURN v_count;
END;
$function$;

-- E/C produttore: la scheda conta se ha un ruolo provvigionato, non solo per tipo
CREATE OR REPLACE FUNCTION public.segna_ec_produttore_pagato(p_anagrafica_id uuid, p_periodo_da date, p_periodo_a date, p_documento_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_count int := 0;
  v_totale numeric := 0;
  v_doc RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Utente non autenticato');
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'cfo'::app_role)
    OR public.has_role(v_uid, 'contabilita'::app_role)
    OR public.has_role(v_uid, 'ufficio'::app_role)
    OR public.has_role(v_uid, 'backoffice'::app_role)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Permesso negato');
  END IF;

  IF p_periodo_da IS NULL OR p_periodo_a IS NULL OR p_periodo_da > p_periodo_a THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Periodo non valido');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.anagrafiche_professionali
    WHERE id = p_anagrafica_id
      AND ruoli && ARRAY['account_executive', 'corrispondente', 'responsabile_sede']
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Produttore non trovato');
  END IF;

  IF p_documento_id IS NOT NULL THEN
    SELECT id, entita_id, categoria INTO v_doc
    FROM public.documenti
    WHERE id = p_documento_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Documento non trovato');
    END IF;

    IF v_doc.categoria IS DISTINCT FROM 'EC Produttore'
       OR v_doc.entita_id IS DISTINCT FROM p_anagrafica_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Documento non valido per questo E/C produttore');
    END IF;
  END IF;

  SELECT
    array_agg(pg.id),
    count(*)::int,
    COALESCE(sum(pg.importo_provvigione), 0)
  INTO v_ids, v_count, v_totale
  FROM public.provvigioni_generate pg
  JOIN public.titoli t ON t.id = pg.titolo_id
  WHERE pg.tipo_destinatario IN ('commerciale', 'ae')
    AND pg.solo_statistico = false
    AND COALESCE(pg.pagata, false) = false
    AND t.data_messa_cassa IS NOT NULL
    AND t.data_messa_cassa >= p_periodo_da
    AND t.data_messa_cassa <= p_periodo_a
    AND (
      COALESCE(pg.anagrafica_commerciale_id, t.anagrafica_commerciale_id) = p_anagrafica_id
      OR pg.user_id IN (
        SELECT pr.id
        FROM public.profiles pr
        INNER JOIN public.anagrafiche_professionali ap
          ON lower(trim(pr.email)) = lower(trim(ap.email))
        WHERE ap.id = p_anagrafica_id
          AND pr.email IS NOT NULL
          AND ap.email IS NOT NULL
      )
    );

  IF v_count = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Nessuna provvigione eleggibile da pagare per il periodo selezionato'
    );
  END IF;

  UPDATE public.provvigioni_generate
  SET pagata = true
  WHERE id = ANY(v_ids)
    AND COALESCE(pagata, false) = false;

  INSERT INTO public.log_attivita (azione, entita_tipo, entita_id, severity, dettagli_json, user_id)
  VALUES (
    'conferma_pagamento_ec_produttore',
    'anagrafica_professionale',
    p_anagrafica_id,
    'info',
    jsonb_build_object(
      'periodo_da', p_periodo_da,
      'periodo_a', p_periodo_a,
      'provvigioni_count', v_count,
      'totale_provvigioni', v_totale,
      'documento_id', p_documento_id,
      'note', NULLIF(trim(p_note), '')
    ),
    v_uid
  );

  RETURN jsonb_build_object(
    'ok', true,
    'count', v_count,
    'totale', v_totale,
    'provvigioni_ids', to_jsonb(v_ids)
  );
END;
$function$;
