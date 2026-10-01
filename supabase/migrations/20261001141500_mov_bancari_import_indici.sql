-- Import estratto conto: match ordinante → cliente e anti-doppio senza scansioni complete.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ilike '%token%' su nomi clienti (match ordinante, ricerca clienti)
CREATE INDEX IF NOT EXISTS idx_clienti_ragione_sociale_trgm
  ON public.clienti USING gin (ragione_sociale extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clienti_cognome_trgm
  ON public.clienti USING gin (cognome extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clienti_nome_trgm
  ON public.clienti USING gin (nome extensions.gin_trgm_ops);

-- Anti-doppio import: movimenti del conto con gli stessi importi del file
CREATE INDEX IF NOT EXISTS idx_movimenti_bancari_conto_importo
  ON public.movimenti_bancari (conto_bancario_id, importo);

-- Candidati cliente per molti token in una sola chiamata (RLS del chiamante).
-- I token arrivano già normalizzati (A-Z, 0-9, spazi).
CREATE OR REPLACE FUNCTION public.clienti_candidati_ordinanti(p_tokens text[])
RETURNS TABLE (
  token text,
  id uuid,
  ragione_sociale text,
  nome text,
  cognome text,
  ufficio_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT t.token, c.id, c.ragione_sociale, c.nome, c.cognome, c.ufficio_id
  FROM (
    SELECT DISTINCT tk AS token
    FROM unnest(p_tokens) AS tk
    WHERE length(tk) >= 3 AND tk !~ '[%_\\]'
  ) t
  CROSS JOIN LATERAL (
    SELECT c.id, c.ragione_sociale, c.nome, c.cognome, c.ufficio_id
    FROM public.clienti c
    WHERE c.ragione_sociale ILIKE '%' || t.token || '%'
       OR c.cognome ILIKE '%' || t.token || '%'
       OR c.nome ILIKE '%' || t.token || '%'
    LIMIT 80
  ) c;
$$;

REVOKE ALL ON FUNCTION public.clienti_candidati_ordinanti(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clienti_candidati_ordinanti(text[]) TO authenticated;
