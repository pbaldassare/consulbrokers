-- Controparte sinistro: solo anagrafica leggera (no CF/P.IVA).

ALTER TABLE public.controparti_sinistri
  ADD COLUMN IF NOT EXISTS pec text,
  ADD COLUMN IF NOT EXISTS cellulare text;

ALTER TABLE public.controparti_sinistri
  DROP COLUMN IF EXISTS codice_fiscale,
  DROP COLUMN IF EXISTS partita_iva;

COMMENT ON COLUMN public.controparti_sinistri.denominazione IS
  'Nome e cognome (privato) o ragione sociale (azienda).';

CREATE OR REPLACE FUNCTION public.search_controparti_sinistri_ranked(
  p_search text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit integer := greatest(coalesce(p_limit, 25), 0);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_term text;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.is_staff() THEN
    RETURN jsonb_build_object('total_count', 0, 'data', '[]'::jsonb);
  END IF;

  v_term := lower(trim(both FROM regexp_replace(coalesce(p_search, ''), '\s+', ' ', 'g')));

  IF v_term = '' THEN
    SELECT jsonb_build_object(
      'total_count', (SELECT count(*)::bigint FROM public.controparti_sinistri),
      'data', coalesce((
        SELECT jsonb_agg(to_jsonb(p) ORDER BY p.denominazione ASC)
        FROM (
          SELECT s.*
          FROM public.controparti_sinistri s
          ORDER BY s.denominazione ASC
          LIMIT v_limit OFFSET v_offset
        ) p
      ), '[]'::jsonb)
    ) INTO v_result;
  ELSE
    WITH scoped AS MATERIALIZED (
      SELECT c.*
      FROM public.controparti_sinistri c
      WHERE lower(c.denominazione) LIKE '%' || v_term || '%'
         OR lower(coalesce(c.email, '')) LIKE '%' || v_term || '%'
         OR lower(coalesce(c.pec, '')) LIKE '%' || v_term || '%'
         OR lower(coalesce(c.telefono, '')) LIKE '%' || v_term || '%'
         OR lower(coalesce(c.cellulare, '')) LIKE '%' || v_term || '%'
         OR lower(coalesce(c.note, '')) LIKE '%' || v_term || '%'
         OR c.codice::text LIKE '%' || v_term || '%'
    )
    SELECT jsonb_build_object(
      'total_count', (SELECT count(*)::bigint FROM scoped),
      'data', coalesce((
        SELECT jsonb_agg(to_jsonb(p) ORDER BY p.denominazione ASC)
        FROM (
          SELECT s.*
          FROM scoped s
          ORDER BY s.denominazione ASC
          LIMIT v_limit OFFSET v_offset
        ) p
      ), '[]'::jsonb)
    ) INTO v_result;
  END IF;

  RETURN coalesce(v_result, jsonb_build_object('total_count', 0, 'data', '[]'::jsonb));
END;
$$;
