-- Registro attività: filtro gravità + RPC con parametro p_gravita.

DROP FUNCTION IF EXISTS public.registro_log_attivita_page(int, int, uuid, text, timestamptz, timestamptz, text);

CREATE INDEX IF NOT EXISTS idx_log_attivita_severity_created_desc
  ON public.log_attivita (severity, created_at DESC);

CREATE OR REPLACE FUNCTION public.registro_log_attivita_page(
  p_page_size int DEFAULT 50,
  p_page int DEFAULT 0,
  p_user_id uuid DEFAULT NULL,
  p_azione text DEFAULT NULL,
  p_da timestamptz DEFAULT NULL,
  p_a timestamptz DEFAULT NULL,
  p_stato text DEFAULT NULL,
  p_gravita text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  azione text,
  severity text,
  entita_tipo text,
  entita_id uuid,
  dettagli_json jsonb,
  user_id uuid,
  esito_fallita boolean,
  nome text,
  cognome text,
  email text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
BEGIN
  IF NOT public.is_root_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo admin@consul.it può consultare il registro attività globale';
  END IF;

  IF p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 200 THEN
    p_page_size := 50;
  END IF;
  IF p_page IS NULL OR p_page < 0 THEN
    p_page := 0;
  END IF;

  SELECT count(*)::bigint INTO v_total
  FROM public.log_attivita la
  WHERE (p_user_id IS NULL OR la.user_id = p_user_id)
    AND (p_azione IS NULL OR btrim(p_azione) = '' OR la.azione ILIKE ('%' || p_azione || '%'))
    AND (p_da IS NULL OR la.created_at >= p_da)
    AND (p_a IS NULL OR la.created_at <= p_a)
    AND (
      p_stato IS NULL OR btrim(p_stato) = '' OR lower(p_stato) = 'all'
      OR (lower(p_stato) = 'fallita' AND la.esito_fallita)
      OR (lower(p_stato) = 'riuscita' AND NOT la.esito_fallita)
    )
    AND (
      p_gravita IS NULL OR btrim(p_gravita) = '' OR lower(p_gravita) = 'all'
      OR lower(la.severity) = lower(p_gravita)
    );

  RETURN QUERY
  SELECT
    la.id,
    la.created_at,
    la.azione,
    la.severity,
    la.entita_tipo,
    la.entita_id,
    la.dettagli_json,
    la.user_id,
    la.esito_fallita,
    p.nome,
    p.cognome,
    p.email,
    v_total AS total_count
  FROM public.log_attivita la
  LEFT JOIN public.profiles p ON p.id = la.user_id
  WHERE (p_user_id IS NULL OR la.user_id = p_user_id)
    AND (p_azione IS NULL OR btrim(p_azione) = '' OR la.azione ILIKE ('%' || p_azione || '%'))
    AND (p_da IS NULL OR la.created_at >= p_da)
    AND (p_a IS NULL OR la.created_at <= p_a)
    AND (
      p_stato IS NULL OR btrim(p_stato) = '' OR lower(p_stato) = 'all'
      OR (lower(p_stato) = 'fallita' AND la.esito_fallita)
      OR (lower(p_stato) = 'riuscita' AND NOT la.esito_fallita)
    )
    AND (
      p_gravita IS NULL OR btrim(p_gravita) = '' OR lower(p_gravita) = 'all'
      OR lower(la.severity) = lower(p_gravita)
    )
  ORDER BY la.created_at DESC
  LIMIT p_page_size
  OFFSET p_page * p_page_size;
END;
$$;

REVOKE ALL ON FUNCTION public.registro_log_attivita_page(int, int, uuid, text, timestamptz, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registro_log_attivita_page(int, int, uuid, text, timestamptz, timestamptz, text, text) TO authenticated;
