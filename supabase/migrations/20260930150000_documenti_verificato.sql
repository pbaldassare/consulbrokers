-- Documenti: flag «Verificato» (chi e quando) su tutte le tabelle di documenti
-- caricati, vista unica per la revisione e RPC per cambiare lo stato.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['documenti', 'trattativa_documenti', 'compagnia_rapporto_documenti', 'document_library', 'documenti_utenti']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS verificato boolean NOT NULL DEFAULT false', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS verificato_da uuid REFERENCES public.profiles(id) ON DELETE SET NULL', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS verificato_il timestamptz', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.documenti_set_verificato_meta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.verificato IS NOT DISTINCT FROM OLD.verificato THEN
    RETURN NEW;
  END IF;
  IF NEW.verificato THEN
    NEW.verificato_da := COALESCE(auth.uid(), NEW.verificato_da);
    NEW.verificato_il := now();
  ELSE
    NEW.verificato_da := NULL;
    NEW.verificato_il := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['documenti', 'trattativa_documenti', 'compagnia_rapporto_documenti', 'document_library', 'documenti_utenti']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_verificato ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_verificato BEFORE INSERT OR UPDATE OF verificato ON public.%I FOR EACH ROW EXECUTE FUNCTION public.documenti_set_verificato_meta()',
      t, t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_documenti_verificato ON public.documenti (verificato, created_at DESC);

-- Vista unica. security_invoker: ogni utente vede solo i documenti che le RLS
-- delle tabelle sorgente gli consentono.
CREATE OR REPLACE VIEW public.v_documenti_revisione
WITH (security_invoker = true) AS
WITH base AS (
  SELECT
    'documenti'::text AS fonte,
    d.id,
    d.nome_file,
    d.path_storage,
    COALESCE(d.bucket_name, 'documenti_generali') AS bucket_name,
    d.categoria,
    d.entita_tipo,
    d.entita_id,
    COALESCE(tt.id, st.id) AS titolo_id,
    COALESCE(s.id, NULL) AS sinistro_id,
    COALESCE(tt.cliente_anagrafica_id, s.cliente_anagrafica_id, cl.id) AS cliente_id,
    COALESCE(tt.numero_titolo, st.numero_titolo, s.numero_polizza) AS numero_polizza,
    s.numero_sinistro,
    COALESCE(tt.compagnia_id, st.compagnia_id, s.compagnia_id,
             CASE WHEN d.entita_tipo IN ('compagnia', 'agenzia') THEN d.entita_id END) AS compagnia_id,
    COALESCE(tt.ramo_id, st.ramo_id) AS ramo_id,
    COALESCE(tt.ufficio_id, s.ufficio_id, cl.ufficio_id, pr.ufficio_id,
             CASE WHEN d.entita_tipo = 'sede' THEN d.entita_id END) AS ufficio_id,
    COALESCE(pr.ragione_sociale, NULLIF(TRIM(COALESCE(pr.cognome, '') || ' ' || COALESCE(pr.nome, '')), '')) AS prospect_nome,
    d.caricato_da,
    COALESCE(d.caricato_da_cliente, false) AS caricato_da_cliente,
    d.created_at,
    d.verificato,
    d.verificato_da,
    d.verificato_il
  FROM public.documenti d
  LEFT JOIN public.titoli tt ON d.entita_tipo = 'titolo' AND tt.id = d.entita_id
  LEFT JOIN public.sinistri s ON d.entita_tipo = 'sinistro' AND s.id = d.entita_id
  LEFT JOIN public.titoli st ON st.id = s.titolo_id
  LEFT JOIN public.clienti cl ON d.entita_tipo = 'cliente' AND cl.id = d.entita_id
  LEFT JOIN public.prospect pr ON d.entita_tipo = 'prospect' AND pr.id = d.entita_id
  -- Documenti di polizze/sinistri eliminati: fuori revisione.
  WHERE NOT (d.entita_tipo = 'titolo' AND tt.id IS NULL)
    AND NOT (d.entita_tipo = 'sinistro' AND s.id IS NULL)

  UNION ALL
  SELECT
    'trattativa_documenti', td.id, td.nome_file, td.file_path, 'documenti_generali', td.tipo_documento,
    'trattativa', td.trattativa_id, NULL, NULL, tr.cliente_id, NULL, NULL,
    tr.compagnia_id, tr.ramo_id, tr.ufficio_id,
    COALESCE(pr.ragione_sociale, NULLIF(TRIM(COALESCE(pr.cognome, '') || ' ' || COALESCE(pr.nome, '')), '')),
    td.uploaded_by, false, td.created_at, td.verificato, td.verificato_da, td.verificato_il
  FROM public.trattativa_documenti td
  LEFT JOIN public.trattative tr ON tr.id = td.trattativa_id
  LEFT JOIN public.prospect pr ON pr.id = tr.prospect_id

  UNION ALL
  SELECT
    'compagnia_rapporto_documenti', rd.id, rd.nome_file, rd.file_path, 'documenti_generali', rd.tipo_documento,
    'rapporto', rd.rapporto_id, NULL, NULL, NULL, NULL, NULL,
    cr.compagnia_id, NULL, NULL, NULL,
    rd.uploaded_by, false, rd.created_at, rd.verificato, rd.verificato_da, rd.verificato_il
  FROM public.compagnia_rapporto_documenti rd
  LEFT JOIN public.compagnia_rapporti cr ON cr.id = rd.rapporto_id

  UNION ALL
  SELECT
    'document_library', dl.id, dl.file_name, dl.file_url, 'document-library', dl.file_type,
    'archivio', dl.folder_id, NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL,
    dl.uploaded_by, false, dl.uploaded_at, dl.verificato, dl.verificato_da, dl.verificato_il
  FROM public.document_library dl
  WHERE dl.active = true

  UNION ALL
  SELECT
    'documenti_utenti', du.id, du.nome_file, du.path_storage, 'documenti-utenti', du.categoria,
    'utente', du.user_id, NULL, NULL, NULL, NULL, NULL,
    NULL, NULL, pf.ufficio_id, NULL,
    du.user_id, false, du.created_at, du.verificato, du.verificato_da, du.verificato_il
  FROM public.documenti_utenti du
  LEFT JOIN public.profiles pf ON pf.id = du.user_id
)
SELECT
  b.*,
  COALESCE(c.ragione_sociale, NULLIF(TRIM(COALESCE(c.cognome, '') || ' ' || COALESCE(c.nome, '')), ''), b.prospect_nome) AS cliente_nome,
  COALESCE(g.garanzie, NULLIF(TRIM(COALESCE(r.codice, '') || ' ' || COALESCE(r.descrizione, '')), '')) AS garanzie,
  gr.descrizione AS gruppo_ramo,
  co.nome AS compagnia_nome,
  u.nome_ufficio AS sede_nome,
  NULLIF(TRIM(COALESCE(pc.cognome, '') || ' ' || COALESCE(pc.nome, '')), '') AS caricato_da_nome,
  NULLIF(TRIM(COALESCE(pv.cognome, '') || ' ' || COALESCE(pv.nome, '')), '') AS verificato_da_nome
FROM base b
LEFT JOIN public.clienti c ON c.id = b.cliente_id
LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT NULLIF(TRIM(p.garanzia), ''), ', ') AS garanzie
    FROM public.premi_garanzia_polizza p
   WHERE b.titolo_id IS NOT NULL AND p.titolo_id = b.titolo_id
) g ON true
LEFT JOIN public.rami r ON r.id = b.ramo_id
LEFT JOIN public.gruppi_ramo gr ON gr.id = r.gruppo_ramo_id
LEFT JOIN public.compagnie co ON co.id = b.compagnia_id
LEFT JOIN public.uffici u ON u.id = b.ufficio_id
LEFT JOIN public.profiles pc ON pc.id = b.caricato_da
LEFT JOIN public.profiles pv ON pv.id = b.verificato_da;

GRANT SELECT ON public.v_documenti_revisione TO authenticated;

-- Cambio stato dalla pagina di revisione: ruoli operativi, anche dove le RLS
-- della tabella sorgente non concedono UPDATE (es. backoffice su documenti).
CREATE OR REPLACE FUNCTION public.set_documento_verificato(p_fonte text, p_ids uuid[], p_verificato boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_n integer;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'cfo') OR has_role(auth.uid(), 'ufficio')
          OR has_role(auth.uid(), 'backoffice') OR has_role(auth.uid(), 'contabilita')) THEN
    RAISE EXCEPTION 'Permesso negato';
  END IF;
  IF p_fonte NOT IN ('documenti', 'trattativa_documenti', 'compagnia_rapporto_documenti', 'document_library', 'documenti_utenti') THEN
    RAISE EXCEPTION 'Fonte documento non valida: %', p_fonte;
  END IF;
  EXECUTE format('UPDATE public.%I SET verificato = $1 WHERE id = ANY($2)', p_fonte)
    USING p_verificato, p_ids;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_documento_verificato(text, uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_documento_verificato(text, uuid[], boolean) TO authenticated;
