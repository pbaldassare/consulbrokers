-- Ripristino vista v_portafoglio_titoli con TUTTE le colonne legacy + le nuove
DROP VIEW IF EXISTS public.v_portafoglio_titoli CASCADE;

CREATE VIEW public.v_portafoglio_titoli AS
WITH base AS (
  SELECT 
    t.*,
    LEAST(
      COALESCE(t.garanzia_a, t.data_scadenza, t.durata_a),
      COALESCE(t.data_scadenza, t.garanzia_a, t.durata_a)
    ) AS fine_periodo_effettivo
  FROM public.titoli t
)
SELECT
  b.*,
  -- Cliente: display + colonne legacy attese dal frontend
  COALESCE(c.ragione_sociale, NULLIF(TRIM(COALESCE(c.cognome,'') || ' ' || COALESCE(c.nome,'')), '')) AS cliente_nome_display,
  c.codice_fiscale AS cliente_codice_fiscale,
  c.partita_iva AS cliente_partita_iva,
  c.tipo_cliente AS cliente_tipo,
  c.codice_ricerca AS cliente_codice,
  c.cognome AS cliente_cognome,
  c.nome AS cliente_nome,
  c.ragione_sociale AS cliente_ragione_sociale,
  -- Compagnia
  comp.nome AS compagnia_nome,
  comp.codice AS compagnia_codice,
  -- Ramo (entrambi gli alias per compatibilità)
  r.descrizione AS ramo_descrizione,
  r.descrizione AS ramo_nome,
  r.codice AS ramo_codice,
  -- Ufficio (entrambi gli alias)
  uff.nome_ufficio AS ufficio_nome,
  uff.nome_ufficio AS nome_ufficio,
  -- Prossimo periodo
  (b.fine_periodo_effettivo + INTERVAL '1 day')::date AS prossima_garanzia_da,
  CASE 
    WHEN b.rate = 1  THEN (b.fine_periodo_effettivo + INTERVAL '1 day' + INTERVAL '12 months' - INTERVAL '1 day')::date
    WHEN b.rate = 2  THEN (b.fine_periodo_effettivo + INTERVAL '1 day' + INTERVAL '6 months'  - INTERVAL '1 day')::date
    WHEN b.rate = 3  THEN (b.fine_periodo_effettivo + INTERVAL '1 day' + INTERVAL '4 months'  - INTERVAL '1 day')::date
    WHEN b.rate = 4  THEN (b.fine_periodo_effettivo + INTERVAL '1 day' + INTERVAL '3 months'  - INTERVAL '1 day')::date
    WHEN b.rate = 12 THEN (b.fine_periodo_effettivo + INTERVAL '1 day' + INTERVAL '1 month'   - INTERVAL '1 day')::date
    ELSE (b.fine_periodo_effettivo + INTERVAL '1 day' + INTERVAL '12 months' - INTERVAL '1 day')::date
  END AS prossima_garanzia_a,
  to_char((b.fine_periodo_effettivo + INTERVAL '1 day')::date, 'YYYY-MM') AS mese_carico,
  CASE 
    WHEN b.fine_periodo_effettivo IS NOT NULL
      AND b.fine_periodo_effettivo < (CURRENT_DATE - INTERVAL '7 days')::date
      AND b.stato = 'incassato'
    THEN false
    ELSE true
  END AS premi_modificabili
FROM base b
LEFT JOIN public.clienti c ON c.id = b.cliente_anagrafica_id
LEFT JOIN public.compagnie comp ON comp.id = b.compagnia_id
LEFT JOIN public.rami r ON r.id = b.ramo_id
LEFT JOIN public.uffici uff ON uff.id = b.ufficio_id;

GRANT SELECT ON public.v_portafoglio_titoli TO authenticated;
GRANT SELECT ON public.v_portafoglio_titoli TO anon;