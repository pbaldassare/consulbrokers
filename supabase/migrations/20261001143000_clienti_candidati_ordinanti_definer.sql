-- clienti_candidati_ordinanti: con RLS l'ILIKE (non leakproof) forza la valutazione delle policy
-- riga per riga su tutta clienti (~300 ms a token) e gli indici trigram non vengono usati.
-- Visibilità calcolata una volta con le stesse regole delle policy SELECT di clienti, poi ricerca via indice.

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
  v_uid uuid := auth.uid();
  v_tutti boolean;
  v_uffici uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  v_tutti := public.is_global_viewer()
    OR public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'cfo'::app_role)
    OR public.has_role(v_uid, 'contabilita'::app_role)
    OR public.has_role(v_uid, 'produttore'::app_role);
  v_uffici := COALESCE(public.get_my_ufficio_ids(), '{}'::uuid[]);

  RETURN QUERY
  SELECT t.token, c.id, c.ragione_sociale, c.nome, c.cognome, c.ufficio_id
  FROM (
    SELECT DISTINCT tk AS token
    FROM unnest(p_tokens) AS tk
    WHERE length(tk) >= 3 AND tk !~ '[%_\\]'
  ) t
  CROSS JOIN LATERAL (
    SELECT c.id, c.ragione_sociale, c.nome, c.cognome, c.ufficio_id
    FROM public.clienti c
    WHERE (c.ragione_sociale ILIKE '%' || t.token || '%'
        OR c.cognome ILIKE '%' || t.token || '%'
        OR c.nome ILIKE '%' || t.token || '%')
      AND (v_tutti OR c.ufficio_id = ANY (v_uffici) OR c.user_id = v_uid)
    LIMIT 80
  ) c;
END;
$$;

REVOKE ALL ON FUNCTION public.clienti_candidati_ordinanti(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clienti_candidati_ordinanti(text[]) TO authenticated;
