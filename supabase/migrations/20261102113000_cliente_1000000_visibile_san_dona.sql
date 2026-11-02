-- Eccezione unica: CONSULBROKERS Società per Azioni (codice 1000000)
-- resta della sua sede e risulta visibile anche a San Donà di Piave.
-- La ricerca clienti è SECURITY DEFINER e non passa dalla RLS.

CREATE TABLE IF NOT EXISTS public.clienti_sede_extra (
  cliente_id uuid NOT NULL REFERENCES public.clienti(id) ON DELETE CASCADE,
  ufficio_id uuid NOT NULL REFERENCES public.uffici(id) ON DELETE CASCADE,
  PRIMARY KEY (cliente_id, ufficio_id)
);

COMMENT ON TABLE public.clienti_sede_extra IS
  'Sedi aggiuntive che vedono il cliente, oltre a clienti.ufficio_id. Non sposta l''assegnazione.';

ALTER TABLE public.clienti_sede_extra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read clienti_sede_extra" ON public.clienti_sede_extra;
CREATE POLICY "Staff read clienti_sede_extra"
  ON public.clienti_sede_extra FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "Admin manage clienti_sede_extra" ON public.clienti_sede_extra;
CREATE POLICY "Admin manage clienti_sede_extra"
  ON public.clienti_sede_extra FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin'::public.app_role)));

GRANT SELECT ON public.clienti_sede_extra TO authenticated;
GRANT ALL ON public.clienti_sede_extra TO service_role;

CREATE OR REPLACE FUNCTION public.cliente_visibile_da_sedi(
  p_cliente_id uuid,
  p_ufficio_id uuid,
  p_sedi uuid[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p_ufficio_id = ANY (coalesce(p_sedi, '{}'::uuid[]))
      OR EXISTS (
        SELECT 1
        FROM public.clienti_sede_extra e
        WHERE e.cliente_id = p_cliente_id
          AND e.ufficio_id = ANY (coalesce(p_sedi, '{}'::uuid[]))
      );
$$;

REVOKE ALL ON FUNCTION public.cliente_visibile_da_sedi(uuid, uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cliente_visibile_da_sedi(uuid, uuid, uuid[]) TO authenticated;

INSERT INTO public.clienti_sede_extra (cliente_id, ufficio_id)
SELECT c.id, u.id
FROM public.clienti c
JOIN public.uffici u ON u.codice_ufficio = 'SD'
WHERE c.codice_cliente = '1000000'
  AND c.ragione_sociale = 'CONSULBROKERS Società per Azioni'
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.clienti_sede_extra e
    JOIN public.clienti c ON c.id = e.cliente_id
    JOIN public.uffici u ON u.id = e.ufficio_id
    WHERE c.codice_cliente = '1000000'
      AND u.codice_ufficio = 'SD'
  ) THEN
    RAISE EXCEPTION 'cliente 1000000 non collegato alla sede SD';
  END IF;
END $$;

ALTER POLICY "Ufficio select own clienti" ON public.clienti
  USING (
    (SELECT public.has_role(auth.uid(), 'ufficio'::public.app_role))
    AND public.cliente_visibile_da_sedi(id, ufficio_id, (SELECT public.get_my_ufficio_ids()))
  );

ALTER POLICY sede_scope_clienti ON public.clienti
  USING (
    (SELECT public.is_global_viewer())
    OR (
      (SELECT public.is_sede_operativo())
      AND public.cliente_visibile_da_sedi(id, ufficio_id, (SELECT public.get_my_ufficio_ids()))
    )
  );

CREATE OR REPLACE FUNCTION public.search_clienti_ranked(
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
  v_see_all boolean;
  v_uffici uuid[];
  v_term text;
  v_toks text[];
  v_limit integer := greatest(coalesce(p_limit, 25), 0);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_result jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('admin', 'cfo', 'contabilita', 'produttore')
  ) INTO v_see_all;

  v_uffici := public.get_my_ufficio_ids();
  v_term := lower(trim(both FROM regexp_replace(coalesce(p_search, ''), '\s+', ' ', 'g')));
  v_toks := CASE
    WHEN v_term = '' THEN ARRAY[]::text[]
    ELSE regexp_split_to_array(v_term, '\s+')
  END;

  IF v_term = '' THEN
    WITH scoped AS MATERIALIZED (
      SELECT c.*
      FROM public.clienti c
      WHERE c.merged_into IS NULL
        AND (
          v_see_all
          OR public.cliente_visibile_da_sedi(c.id, c.ufficio_id, v_uffici)
          OR c.user_id = v_uid
        )
    )
    SELECT jsonb_build_object(
      'total_count', (SELECT count(*)::bigint FROM scoped),
      'data', coalesce((
        SELECT jsonb_agg(to_jsonb(p) ORDER BY p.cognome ASC NULLS LAST, p.ragione_sociale ASC NULLS LAST)
        FROM (
          SELECT s.*
          FROM scoped s
          ORDER BY s.cognome ASC NULLS LAST, s.ragione_sociale ASC NULLS LAST
          LIMIT v_limit OFFSET v_offset
        ) p
      ), '[]'::jsonb)
    ) INTO v_result;

    RETURN coalesce(v_result, jsonb_build_object('total_count', 0, 'data', '[]'::jsonb));
  END IF;

  WITH scoped AS MATERIALIZED (
    SELECT c.*
    FROM public.clienti c
    WHERE c.merged_into IS NULL
      AND (
        v_see_all
        OR public.cliente_visibile_da_sedi(c.id, c.ufficio_id, v_uffici)
        OR c.user_id = v_uid
      )
  ),
  nomi AS MATERIALIZED (
    SELECT
      n.cliente_id,
      string_agg(trim(both FROM coalesce(n.nome, '') || ' ' || coalesce(n.cognome, '')), ' ') AS blob
    FROM public.nominativi_cliente n
    WHERE n.cliente_id IN (SELECT id FROM scoped)
    GROUP BY n.cliente_id
  ),
  scored AS MATERIALIZED (
    SELECT
      s.*,
      CASE
        WHEN lower(trim(both FROM coalesce(s.citta_sede, ''))) = v_term
          OR lower(trim(both FROM coalesce(s.citta_fiscale, ''))) = v_term
          OR lower(trim(both FROM coalesce(s.citta_alternativa, ''))) = v_term
          OR lower(trim(both FROM coalesce(s.indirizzo_sede, ''))) = v_term
          THEN 1
        WHEN lower(trim(both FROM coalesce(s.ragione_sociale, ''))) = v_term
          OR lower(trim(both FROM coalesce(s.cognome, ''))) = v_term
          OR lower(trim(both FROM coalesce(s.nome, ''))) = v_term
          OR blob.display_cn = v_term
          OR blob.display_nc = v_term
          THEN 2
        WHEN lower(coalesce(s.ragione_sociale, '')) LIKE v_term || '%'
          OR lower(coalesce(s.cognome, '')) LIKE v_term || '%'
          OR lower(coalesce(s.nome, '')) LIKE v_term || '%'
          OR blob.display_cn LIKE v_term || '%'
          OR blob.display_nc LIKE v_term || '%'
          THEN 3
        WHEN lower(coalesce(s.ragione_sociale, '')) LIKE '%' || v_term || '%'
          OR lower(coalesce(s.cognome, '')) LIKE '%' || v_term || '%'
          OR lower(coalesce(s.nome, '')) LIKE '%' || v_term || '%'
          OR blob.display_cn LIKE '%' || v_term || '%'
          OR blob.display_nc LIKE '%' || v_term || '%'
          OR blob.search_blob LIKE '%' || v_term || '%'
          OR (
            cardinality(v_toks) > 0
            AND NOT EXISTS (
              SELECT 1
              FROM unnest(v_toks) AS tok
              WHERE blob.search_blob NOT LIKE '%' || tok || '%'
            )
          )
          THEN 4
        ELSE 5
      END AS relevance_score
    FROM scoped s
    LEFT JOIN nomi n ON n.cliente_id = s.id
    CROSS JOIN LATERAL (
      SELECT
        lower(trim(both FROM regexp_replace(
          coalesce(s.cognome, '') || ' ' ||
          coalesce(s.nome, '') || ' ' ||
          coalesce(s.ragione_sociale, '') || ' ' ||
          coalesce(s.codice_fiscale, '') || ' ' ||
          coalesce(s.codice_fiscale_azienda, '') || ' ' ||
          coalesce(s.partita_iva, '') || ' ' ||
          coalesce(s.telefono, '') || ' ' ||
          coalesce(s.cellulare, '') || ' ' ||
          coalesce(s.codice_ricerca, '') || ' ' ||
          coalesce(s.codice_cliente, '') || ' ' ||
          coalesce(s.indirizzo_sede, '') || ' ' ||
          coalesce(s.indirizzo_fiscale, '') || ' ' ||
          coalesce(s.indirizzo_alternativo, '') || ' ' ||
          coalesce(s.cap_sede, '') || ' ' ||
          coalesce(s.cap_fiscale, '') || ' ' ||
          coalesce(s.cap_alternativo, '') || ' ' ||
          coalesce(s.citta_sede, '') || ' ' ||
          coalesce(s.citta_fiscale, '') || ' ' ||
          coalesce(s.citta_alternativa, '') || ' ' ||
          coalesce(s.provincia_sede, '') || ' ' ||
          coalesce(s.provincia_fiscale, '') || ' ' ||
          coalesce(s.provincia_alternativa, '') || ' ' ||
          coalesce(n.blob, ''),
          '\s+', ' ', 'g'
        ))) AS search_blob,
        lower(trim(both FROM regexp_replace(
          coalesce(s.cognome, '') || ' ' || coalesce(s.nome, ''),
          '\s+', ' ', 'g'
        ))) AS display_cn,
        lower(trim(both FROM regexp_replace(
          coalesce(s.nome, '') || ' ' || coalesce(s.cognome, ''),
          '\s+', ' ', 'g'
        ))) AS display_nc
    ) blob
    WHERE blob.search_blob LIKE '%' || v_term || '%'
      OR (
        cardinality(v_toks) > 0
        AND NOT EXISTS (
          SELECT 1
          FROM unnest(v_toks) AS tok
          WHERE blob.search_blob NOT LIKE '%' || tok || '%'
        )
      )
  ),
  ranked AS MATERIALIZED (
    SELECT
      sc.*,
      count(*) OVER () AS _total,
      row_number() OVER (
        ORDER BY sc.relevance_score ASC, sc.cognome ASC NULLS LAST, sc.ragione_sociale ASC NULLS LAST
      ) AS _rn
    FROM scored sc
  )
  SELECT jsonb_build_object(
    'total_count', coalesce((SELECT r._total FROM ranked r LIMIT 1), 0)::bigint,
    'data', coalesce((
      SELECT jsonb_agg(to_jsonb(p) - 'relevance_score' - '_total' - '_rn' ORDER BY p._rn)
      FROM ranked p
      WHERE p._rn > v_offset AND p._rn <= v_offset + v_limit
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN coalesce(v_result, jsonb_build_object('total_count', 0, 'data', '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.search_clienti_ranked(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_clienti_ranked(text, integer, integer) TO authenticated;
