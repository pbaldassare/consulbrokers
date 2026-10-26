-- Specialist (profiles.backoffice) = stessi privilegi Resp. Sede (solo etichetta/tendine restano distinte).

CREATE OR REPLACE FUNCTION public.is_admin_or_responsabile_sede()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN ('admin', 'responsabile_sede', 'backoffice')
  );
$function$;

REVOKE ALL ON FUNCTION public.is_admin_or_responsabile_sede() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_responsabile_sede() TO authenticated;

-- merge clienti / deduplica
CREATE OR REPLACE FUNCTION public.merge_cliente_atomico(_master_id uuid, _legacy_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
  v_titoli int := 0;
  v_sinistri int := 0;
  v_documenti int := 0;
  v_trattative int := 0;
  v_codici int := 0;
  v_nominativi int := 0;
  v_privacy int := 0;
  v_canali int := 0;
BEGIN
  IF NOT public.is_admin_or_responsabile_sede() THEN
    RAISE EXCEPTION 'Permesso negato: solo admin, responsabile sede o specialist';
  END IF;

  IF _master_id = _legacy_id THEN
    RAISE EXCEPTION 'Master e legacy non possono coincidere';
  END IF;

  SELECT to_jsonb(c.*) INTO v_snapshot FROM public.clienti c WHERE c.id = _legacy_id;
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Cliente legacy non trovato';
  END IF;

  UPDATE public.titoli SET cliente_anagrafica_id = _master_id WHERE cliente_anagrafica_id = _legacy_id;
  GET DIAGNOSTICS v_titoli = ROW_COUNT;

  UPDATE public.sinistri SET cliente_anagrafica_id = _master_id WHERE cliente_anagrafica_id = _legacy_id;
  GET DIAGNOSTICS v_sinistri = ROW_COUNT;

  UPDATE public.documenti SET entita_id = _master_id WHERE entita_tipo = 'cliente' AND entita_id = _legacy_id;
  GET DIAGNOSTICS v_documenti = ROW_COUNT;

  UPDATE public.trattative SET cliente_id = _master_id WHERE cliente_id = _legacy_id;
  GET DIAGNOSTICS v_trattative = ROW_COUNT;

  DELETE FROM public.codici_commerciali_cliente l
  WHERE l.cliente_id = _legacy_id
    AND EXISTS (
      SELECT 1 FROM public.codici_commerciali_cliente m
      WHERE m.cliente_id = _master_id AND m.ruolo = l.ruolo
    );

  UPDATE public.codici_commerciali_cliente SET cliente_id = _master_id WHERE cliente_id = _legacy_id;
  GET DIAGNOSTICS v_codici = ROW_COUNT;

  UPDATE public.nominativi_cliente SET cliente_id = _master_id WHERE cliente_id = _legacy_id;
  GET DIAGNOSTICS v_nominativi = ROW_COUNT;

  UPDATE public.privacy_consensi SET cliente_id = _master_id WHERE cliente_id = _legacy_id;
  GET DIAGNOSTICS v_privacy = ROW_COUNT;

  UPDATE public.chat_canali SET entita_id = _master_id::text WHERE entita_tipo = 'cliente' AND entita_id = _legacy_id::text;
  GET DIAGNOSTICS v_canali = ROW_COUNT;

  UPDATE public.clienti
  SET attivo = false,
      merged_into = _master_id,
      merged_at = now(),
      merged_by = auth.uid(),
      note = COALESCE(note,'') || ' [MERGED in ' || _master_id::text || ' il ' || to_char(now(),'YYYY-MM-DD') || ']'
  WHERE id = _legacy_id;

  INSERT INTO public.clienti_merge_log (cliente_master_id, cliente_legacy_id, snapshot_legacy, entita_spostate, eseguito_da)
  VALUES (
    _master_id, _legacy_id, v_snapshot,
    jsonb_build_object(
      'titoli', v_titoli, 'sinistri', v_sinistri, 'documenti', v_documenti,
      'trattative', v_trattative, 'codici_commerciali', v_codici,
      'nominativi', v_nominativi, 'privacy_consensi', v_privacy, 'chat_canali', v_canali
    ),
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', true,
    'master_id', _master_id,
    'legacy_id', _legacy_id,
    'spostate', jsonb_build_object(
      'titoli', v_titoli, 'sinistri', v_sinistri, 'documenti', v_documenti,
      'trattative', v_trattative, 'codici_commerciali', v_codici,
      'nominativi', v_nominativi, 'privacy_consensi', v_privacy, 'chat_canali', v_canali
    )
  );
END;
$$;

DROP POLICY IF EXISTS "Admin/responsabile can view merge log" ON public.clienti_merge_log;
CREATE POLICY "Admin/responsabile can view merge log"
  ON public.clienti_merge_log FOR SELECT TO authenticated
  USING ((SELECT public.is_admin_or_responsabile_sede()));

DROP POLICY IF EXISTS "Service role can insert merge log" ON public.clienti_merge_log;
CREATE POLICY "Service role can insert merge log"
  ON public.clienti_merge_log FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_or_responsabile_sede()));

DROP POLICY IF EXISTS "Admin/Responsabile manage conti_bancari_uffici" ON public.conti_bancari_uffici;
CREATE POLICY "Admin/Responsabile manage conti_bancari_uffici"
  ON public.conti_bancari_uffici FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_responsabile_sede()))
  WITH CHECK ((SELECT public.is_admin_or_responsabile_sede()));

DROP POLICY IF EXISTS "aliquote_rca_write" ON public.aliquote_provinciali_rca;
CREATE POLICY "aliquote_rca_write" ON public.aliquote_provinciali_rca
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin_or_responsabile_sede()))
  WITH CHECK ((SELECT public.is_admin_or_responsabile_sede()));

DROP POLICY IF EXISTS "Storico gare insert admin/responsabile" ON public.storico_gare;
CREATE POLICY "Storico gare insert admin/responsabile"
  ON public.storico_gare FOR INSERT
  WITH CHECK ((SELECT public.is_admin_or_responsabile_sede()));

DROP POLICY IF EXISTS "Storico gare update admin/responsabile" ON public.storico_gare;
CREATE POLICY "Storico gare update admin/responsabile"
  ON public.storico_gare FOR UPDATE
  USING ((SELECT public.is_admin_or_responsabile_sede()));

DROP POLICY IF EXISTS "Storico gare delete admin/responsabile" ON public.storico_gare;
CREATE POLICY "Storico gare delete admin/responsabile"
  ON public.storico_gare FOR DELETE
  USING ((SELECT public.is_admin_or_responsabile_sede()));
