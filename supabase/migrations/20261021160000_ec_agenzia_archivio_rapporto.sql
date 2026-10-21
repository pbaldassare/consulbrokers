-- E/C agenzia archiviati: traccia mandato (rapporto plurimandataria)

ALTER TABLE public.ec_agenzia_archivio
  ADD COLUMN IF NOT EXISTS compagnia_rapporto_id uuid REFERENCES public.compagnia_rapporti(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mandataria text;

COMMENT ON COLUMN public.ec_agenzia_archivio.compagnia_rapporto_id IS 'Rapporto mandato quando E/C splittato per plurimandataria';
COMMENT ON COLUMN public.ec_agenzia_archivio.mandataria IS 'Etichetta compagnia assicurativa (gruppo) per ricerca/storico';

CREATE INDEX IF NOT EXISTS idx_ec_agenzia_archivio_rapporto
  ON public.ec_agenzia_archivio (compagnia_rapporto_id)
  WHERE compagnia_rapporto_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cerca_ec_agenzia_storico(
  p_compagnia_id uuid DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_q text DEFAULT NULL,
  p_riferimento text DEFAULT NULL,
  p_cliente text DEFAULT NULL,
  p_polizza text DEFAULT NULL,
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := NULLIF(trim(p_q), '');
  v_rif text := NULLIF(trim(p_riferimento), '');
  v_cli text := NULLIF(lower(trim(p_cliente)), '');
  v_pol text := NULLIF(lower(trim(p_polizza)), '');
  v_has_meta_filter boolean;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non autenticato');
  END IF;

  v_has_meta_filter := v_rif IS NOT NULL OR v_cli IS NOT NULL OR v_pol IS NOT NULL;

  SELECT count(*) INTO v_total
  FROM public.documenti d
  LEFT JOIN public.ec_agenzia_archivio a ON a.documento_id = d.id
  WHERE d.categoria = 'EC Agenzia'
    AND (p_compagnia_id IS NULL OR d.entita_id = p_compagnia_id)
    AND (p_date_from IS NULL OR d.created_at::date >= p_date_from)
    AND (p_date_to IS NULL OR d.created_at::date <= p_date_to)
    AND (
      v_q IS NULL
      OR d.nome_file ILIKE '%' || v_q || '%'
      OR a.riferimento ILIKE '%' || v_q || '%'
      OR a.testo_ricerca ILIKE '%' || lower(v_q) || '%'
      OR coalesce(a.mandataria, '') ILIKE '%' || v_q || '%'
    )
    AND (v_rif IS NULL OR a.riferimento ILIKE '%' || v_rif || '%')
    AND (v_cli IS NULL OR a.testo_ricerca ILIKE '%' || v_cli || '%')
    AND (v_pol IS NULL OR a.testo_ricerca ILIKE '%' || v_pol || '%')
    AND (NOT v_has_meta_filter OR a.id IS NOT NULL);

  SELECT coalesce(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      d.id AS documento_id,
      d.nome_file,
      d.path_storage,
      d.bucket_name,
      d.created_at,
      d.entita_id AS compagnia_id,
      a.compagnia_rapporto_id,
      a.mandataria,
      a.riferimento,
      a.periodo_testo,
      a.data_estratto_conto,
      a.righe
    FROM public.documenti d
    LEFT JOIN public.ec_agenzia_archivio a ON a.documento_id = d.id
    WHERE d.categoria = 'EC Agenzia'
      AND (p_compagnia_id IS NULL OR d.entita_id = p_compagnia_id)
      AND (p_date_from IS NULL OR d.created_at::date >= p_date_from)
      AND (p_date_to IS NULL OR d.created_at::date <= p_date_to)
      AND (
        v_q IS NULL
        OR d.nome_file ILIKE '%' || v_q || '%'
        OR a.riferimento ILIKE '%' || v_q || '%'
        OR a.testo_ricerca ILIKE '%' || lower(v_q) || '%'
        OR coalesce(a.mandataria, '') ILIKE '%' || v_q || '%'
      )
      AND (v_rif IS NULL OR a.riferimento ILIKE '%' || v_rif || '%')
      AND (v_cli IS NULL OR a.testo_ricerca ILIKE '%' || v_cli || '%')
      AND (v_pol IS NULL OR a.testo_ricerca ILIKE '%' || v_pol || '%')
      AND (NOT v_has_meta_filter OR a.id IS NOT NULL)
    ORDER BY d.created_at DESC
    LIMIT greatest(p_limit, 1)
    OFFSET greatest(p_offset, 0)
  ) x;

  RETURN jsonb_build_object('ok', true, 'total', v_total, 'rows', v_rows);
END;
$$;
