-- Messa a cassa atomica: tutte le scritture del MessaCassaDialog in un'unica transazione.
-- Se un passo fallisce (vincolo, trigger, RLS) non resta salvato nulla.
-- SECURITY INVOKER: valgono le stesse regole RLS di quando il dialog scriveva tabella per tabella.
-- Fuori transazione restano (lato app, dopo il commit): calcolo provvigioni, email agenzia, collegamento bonifici.
--
-- p = {
--   titoli: [{ id, numero, set:{...campi titoli}, credito:{cliente_id,importo,data}|null,
--              utilizzi:[{anticipo_id,importo_utilizzato,data_utilizzo}], movimenti:[movimenti_contabili],
--              giroconti:[giroconti_cliente], compensazioni:[titoli_compensazioni],
--              modalita:titoli_modalita_incasso|null, log:{azione,dettagli_json} }],
--   cig_madri: [{ id, cig_rif, cig_temporaneo }],
--   acconti:   [cliente_anticipi]
-- }

CREATE OR REPLACE FUNCTION public.conferma_messa_cassa(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ufficio uuid;
  t jsonb;
  s jsonb;
  v_id uuid;
  v_num text;
  v_cred numeric;
  v_causale uuid;
  v_anticipo uuid;
  v_ok int := 0;
  v_crediti int := 0;
  v_crediti_importo numeric := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessione scaduta: rientra in CBnet e riprova';
  END IF;
  SELECT ufficio_id INTO v_ufficio FROM profiles WHERE id = v_uid;

  FOR t IN SELECT * FROM jsonb_array_elements(coalesce(p->'titoli', '[]'::jsonb)) LOOP
    v_id := (t->>'id')::uuid;
    v_num := coalesce(nullif(t->>'numero', ''), left(v_id::text, 8));
    s := coalesce(t->'set', '{}'::jsonb);

    BEGIN
      -- 1) titolo
      UPDATE titoli SET
        importo_incassato     = CASE WHEN s ? 'importo_incassato' THEN (s->>'importo_incassato')::numeric ELSE importo_incassato END,
        tipo_pagamento        = CASE WHEN s ? 'tipo_pagamento' THEN s->>'tipo_pagamento' ELSE tipo_pagamento END,
        stato                 = CASE WHEN s ? 'stato' THEN s->>'stato' ELSE stato END,
        data_messa_cassa      = CASE WHEN s ? 'data_messa_cassa' THEN (s->>'data_messa_cassa')::date ELSE data_messa_cassa END,
        data_pagamento        = CASE WHEN s ? 'data_pagamento' THEN (s->>'data_pagamento')::date ELSE data_pagamento END,
        data_decorrenza_rinnovo = CASE WHEN s ? 'data_decorrenza_rinnovo' THEN (s->>'data_decorrenza_rinnovo')::date ELSE data_decorrenza_rinnovo END,
        data_incasso          = CASE WHEN s ? 'data_incasso' THEN (s->>'data_incasso')::date ELSE data_incasso END,
        data_copertura        = CASE WHEN s ? 'data_copertura' THEN (s->>'data_copertura')::date ELSE data_copertura END,
        fondi_ricevuti        = CASE WHEN s ? 'fondi_ricevuti' THEN (s->>'fondi_ricevuti')::boolean ELSE fondi_ricevuti END,
        banca_pagamento       = CASE WHEN s ? 'banca_pagamento' THEN s->>'banca_pagamento' ELSE banca_pagamento END,
        pag_diretto_compagnia = CASE WHEN s ? 'pag_diretto_compagnia' THEN (s->>'pag_diretto_compagnia')::boolean ELSE pag_diretto_compagnia END,
        cig_rif               = CASE WHEN s ? 'cig_rif' THEN s->>'cig_rif' ELSE cig_rif END,
        cig_temporaneo        = CASE WHEN s ? 'cig_temporaneo' THEN (s->>'cig_temporaneo')::boolean ELSE cig_temporaneo END,
        updated_at            = now()
      WHERE id = v_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'titolo non trovato o non modificabile con il tuo profilo';
      END IF;

      -- 2) titolo a credito → acconto cliente (idempotente su titolo_origine_id)
      IF t->'credito' IS NOT NULL AND jsonb_typeof(t->'credito') = 'object'
         AND NOT EXISTS (SELECT 1 FROM cliente_anticipi WHERE titolo_origine_id = v_id) THEN
        v_cred := (t->'credito'->>'importo')::numeric;
        SELECT c.id INTO v_causale FROM causali_contabili c
         WHERE c.tipo_tabella = 'compensazione_messa_cassa' AND c.codice IN ('ACC_CRED', 'ECCED', 'ACC_STOR')
         ORDER BY array_position(ARRAY['ACC_CRED', 'ECCED', 'ACC_STOR'], c.codice) LIMIT 1;
        IF v_causale IS NULL THEN
          RAISE EXCEPTION 'causale contabile ACC_CRED/ECCED non trovata';
        END IF;
        INSERT INTO cliente_anticipi (cliente_id, data_anticipo, importo, importo_residuo, note, titolo_origine_id,
                                      creato_da, conto_bancario_id, causale_id, segno)
        VALUES ((t->'credito'->>'cliente_id')::uuid, (t->'credito'->>'data')::date, v_cred, v_cred,
                'Da appendice/titolo a credito ' || v_num || ' (conguaglio premio)', v_id,
                v_uid, NULL, v_causale, '+')
        RETURNING id INTO v_anticipo;
        INSERT INTO log_attivita (user_id, azione, entita_tipo, entita_id, dettagli_json, severity, ufficio_id)
        VALUES (v_uid, 'anticipo_da_titolo_credito', 'titolo', v_id,
                jsonb_build_object('anticipo_id', v_anticipo, 'importo', v_cred, 'cliente_id', t->'credito'->>'cliente_id'),
                'info', v_ufficio);
        v_crediti := v_crediti + 1;
        v_crediti_importo := v_crediti_importo + v_cred;
      END IF;

      -- 3) utilizzi acconti
      INSERT INTO cliente_anticipi_utilizzi (anticipo_id, titolo_id, importo_utilizzato, data_utilizzo, creato_da)
      SELECT (u->>'anticipo_id')::uuid, v_id, (u->>'importo_utilizzato')::numeric, (u->>'data_utilizzo')::date, v_uid
        FROM jsonb_array_elements(coalesce(t->'utilizzi', '[]'::jsonb)) u;

      -- 4) giroconti inter-cliente
      INSERT INTO giroconti_cliente (data, cliente_pagatore_id, cliente_beneficiario_id, titolo_id, anticipo_id, importo, note, created_by)
      SELECT (g->>'data')::date, (g->>'cliente_pagatore_id')::uuid, (g->>'cliente_beneficiario_id')::uuid, v_id,
             (g->>'anticipo_id')::uuid, (g->>'importo')::numeric, g->>'note', v_uid
        FROM jsonb_array_elements(coalesce(t->'giroconti', '[]'::jsonb)) g;

      -- 5) abbuoni / compensazioni sulla quietanza
      INSERT INTO titoli_compensazioni (titolo_id, causale_id, causale_codice, causale_descrizione, importo, segno, note, creato_da)
      SELECT v_id, (c->>'causale_id')::uuid, c->>'causale_codice', c->>'causale_descrizione',
             (c->>'importo')::numeric, c->>'segno', c->>'note', v_uid
        FROM jsonb_array_elements(coalesce(t->'compensazioni', '[]'::jsonb)) c;

      -- 6) prima nota (utilizzo acconti + abbuoni)
      INSERT INTO movimenti_contabili (ufficio_id, tipo, categoria, riferimento_tipo, riferimento_id, importo,
                                       data_movimento, descrizione, stato, created_by)
      SELECT (m->>'ufficio_id')::uuid, m->>'tipo', m->>'categoria', 'titolo', v_id, (m->>'importo')::numeric,
             (m->>'data_movimento')::date, m->>'descrizione', coalesce(m->>'stato', 'registrato'), v_uid
        FROM jsonb_array_elements(coalesce(t->'movimenti', '[]'::jsonb)) m;

      -- 7) produttore trattiene la provvigione
      IF t->'modalita' IS NOT NULL AND jsonb_typeof(t->'modalita') = 'object' THEN
        INSERT INTO titoli_modalita_incasso (titolo_id, modalita, anagrafica_commerciale_id, importo_dovuto_lordo,
          importo_provvigione_lorda, importo_ra, importo_trattenuto_netto, importo_versato_consul, stato, applicata_da)
        VALUES (v_id, t->'modalita'->>'modalita', (t->'modalita'->>'anagrafica_commerciale_id')::uuid,
          (t->'modalita'->>'importo_dovuto_lordo')::numeric, (t->'modalita'->>'importo_provvigione_lorda')::numeric,
          (t->'modalita'->>'importo_ra')::numeric, (t->'modalita'->>'importo_trattenuto_netto')::numeric,
          (t->'modalita'->>'importo_versato_consul')::numeric, 'attiva', v_uid);
      END IF;

      -- 8) log attività
      IF t->'log' IS NOT NULL AND jsonb_typeof(t->'log') = 'object' THEN
        INSERT INTO log_attivita (user_id, azione, entita_tipo, entita_id, dettagli_json, severity, ufficio_id)
        VALUES (v_uid, t->'log'->>'azione', 'titolo', v_id, t->'log'->'dettagli_json', 'info', v_ufficio);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Annulla tutto e indica su quale titolo si è fermato
      RAISE EXCEPTION 'Titolo %: %', v_num, SQLERRM USING ERRCODE = SQLSTATE;
    END;

    v_ok := v_ok + 1;
  END LOOP;

  -- 9) CIG condiviso sulla polizza madre
  UPDATE titoli m SET cig_rif = x.cig_rif, cig_temporaneo = x.cig_temporaneo, updated_at = now()
    FROM jsonb_to_recordset(coalesce(p->'cig_madri', '[]'::jsonb)) AS x(id uuid, cig_rif text, cig_temporaneo boolean)
   WHERE m.id = x.id;

  -- 10) acconti ACC_* classificati a mano (una volta, sul cliente pagatore)
  INSERT INTO cliente_anticipi (cliente_id, data_anticipo, conto_bancario_id, importo, causale_id, segno,
                                importo_residuo, note, creato_da)
  SELECT (a->>'cliente_id')::uuid, (a->>'data_anticipo')::date, (a->>'conto_bancario_id')::uuid,
         (a->>'importo')::numeric, (a->>'causale_id')::uuid, a->>'segno',
         (a->>'importo_residuo')::numeric, a->>'note', v_uid
    FROM jsonb_array_elements(coalesce(p->'acconti', '[]'::jsonb)) a;

  RETURN jsonb_build_object('ok', v_ok, 'crediti', v_crediti, 'crediti_importo', v_crediti_importo);
END;
$$;

REVOKE ALL ON FUNCTION public.conferma_messa_cassa(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.conferma_messa_cassa(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.conferma_messa_cassa(jsonb) TO authenticated;
