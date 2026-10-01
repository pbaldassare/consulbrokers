-- clienti_candidati_ordinanti: la visibilità non è più una copia delle policy di clienti.
-- A ogni chiamata legge da pg_policies le policy SELECT/ALL vigenti su public.clienti
-- (permissive in OR, restrictive in AND) e le applica dopo la ricerca trigram.
-- Qualsiasi CREATE/ALTER/DROP POLICY su clienti vale subito anche qui.
-- Gira SECURITY DEFINER perché con RLS l'ILIKE (non leakproof) impedisce l'uso dell'indice.

CREATE OR REPLACE FUNCTION public.clienti_candidati_ordinanti(p_tokens text[])
RETURNS TABLE (
  token text,
  id uuid,
  ragione_sociale text,
  nome text,
  cognome text,
  ufficio_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_permissive text;
  v_restrictive text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT
    string_agg('(' || p.qual || ')', ' OR ') FILTER (WHERE p.permissive = 'PERMISSIVE'),
    string_agg('(' || p.qual || ')', ' AND ') FILTER (WHERE p.permissive = 'RESTRICTIVE')
  INTO v_permissive, v_restrictive
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = 'clienti'
    AND p.cmd IN ('SELECT', 'ALL')
    AND p.qual IS NOT NULL
    AND p.roles && ARRAY['public', 'authenticated']::name[];

  IF v_permissive IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY EXECUTE format($q$
    SELECT t.token, c.id, c.ragione_sociale, c.nome, c.cognome, c.ufficio_id
    FROM (
      SELECT DISTINCT tk AS token
      FROM unnest($1) AS tk
      WHERE length(tk) >= 3 AND tk !~ '[%%_\\]'
    ) t
    CROSS JOIN LATERAL (
      SELECT clienti.id, clienti.ragione_sociale, clienti.nome, clienti.cognome, clienti.ufficio_id
      FROM public.clienti
      WHERE (clienti.ragione_sociale ILIKE '%%' || t.token || '%%'
          OR clienti.cognome ILIKE '%%' || t.token || '%%'
          OR clienti.nome ILIKE '%%' || t.token || '%%')
        AND (%s)
        AND (%s)
      LIMIT 80
    ) c
  $q$, v_permissive, COALESCE(v_restrictive, 'true'))
  USING p_tokens;
END;
$$;

REVOKE ALL ON FUNCTION public.clienti_candidati_ordinanti(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clienti_candidati_ordinanti(text[]) TO authenticated;
