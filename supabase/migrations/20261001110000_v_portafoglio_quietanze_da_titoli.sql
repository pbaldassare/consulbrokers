-- Incassi / Carico / Attive / Storico / export: la vista nasce da `titoli`
-- (fonte affidabile per stato e messa a cassa), una riga per titolo.
-- `polizze` / `quietanze` legacy restano solo come join opzionali per i link.
--
-- Prima la vista partiva da `quietanze`: i titoli senza riga legacy (es. polizze
-- promosse da 20260928181000) sparivano da Incassi, e numero_rata veniva dalla
-- quietanza legacy ("Polizza 2/2", "Quietanza 1/3").
--
-- numero_rata: polizza madre = 1; rate successive = posizione nell'annualità
-- calcolata dalla distanza tra garanzia_da della rata e della madre.
-- numero_rate_totali: rate/anno da frazionamento (fallback titoli.rate).
--
-- Copie 1/1 legacy (figlia con stessa garanzia_da e stesso premio della madre):
-- resta una sola riga, la madre, salvo che l'incasso stia solo sulla figlia.

CREATE INDEX IF NOT EXISTS idx_titoli_madre_numero
  ON public.titoli (numero_titolo, compagnia_id)
  WHERE sostituisce_polizza IS NULL;

DROP VIEW IF EXISTS public.v_portafoglio_quietanze;

CREATE VIEW public.v_portafoglio_quietanze
WITH (security_invoker = true) AS
SELECT
  t.id,
  q.id AS quietanza_id,
  p.id AS polizza_id,
  t.id AS titolo_legacy_id,
  COALESCE(t.sostituisce_polizza, t.numero_titolo) AS numero_titolo,
  t.numero_titolo AS titolo_derivato_numero,
  q.numero_polizza_snapshot,
  COALESCE(t.cig_rif, p.cig_rif) AS cig_rif,
  p.appendice_corrente,
  t.cliente_anagrafica_id,
  COALESCE(
    cli.ragione_sociale,
    NULLIF(TRIM(BOTH FROM (COALESCE(cli.cognome, '') || ' ' || COALESCE(cli.nome, ''))), ''),
    '—'
  ) AS cliente_nome_display,
  cli.codice_cliente AS cliente_codice,
  t.compagnia_id,
  comp.nome AS compagnia_nome,
  t.ramo_id,
  r.descrizione AS ramo_nome,
  r.codice AS ramo_codice,
  t.stato,
  q.stato AS stato_quietanza,
  p.stato AS stato_polizza,
  t.garanzia_da,
  t.garanzia_a,
  t.data_competenza,
  t.data_scadenza,
  t.premio_lordo,
  t.premio_netto,
  t.tasse,
  t.addizionali,
  COALESCE(t.ssn_quietanza, t.ssn_firma) AS ssn,
  t.provvigioni_firma,
  COALESCE(NULLIF(t.provvigioni_quietanza, 0::numeric), t.provvigioni_firma) AS provvigioni_quietanza,
  t.importo_incassato,
  t.rate,
  COALESCE(t.frazionamento, m.frazionamento) AS frazionamento,
  t.targa_telaio,
  t.ae_nome,
  t.specialist,
  t.produttore_nome,
  t.produttore_nome AS produttori_display,
  t.descrizione_polizza,
  t.tipo_portafoglio,
  t.tacito_rinnovo,
  t.regolazione,
  t.durata_da,
  t.durata_a,
  t.data_messa_cassa,
  t.data_pagamento,
  t.data_incasso,
  t.data_copertura,
  t.data_decorrenza_rinnovo,
  t.conferimento_gestito,
  t.fondi_ricevuti,
  t.data_sospensione,
  t.data_riattivazione,
  t.limite_riattivazione,
  t.sostituisce_polizza,
  COALESCE(t.is_regolazione, false) AS is_regolazione,
  COALESCE(t.is_proroga, false) AS is_proroga,
  COALESCE(t.is_appendice_modifica, false) AS is_appendice_modifica,
  t.regolazione_quietanza_id,
  t.proroga_polizza_madre_id,
  t.appendice_modifica_polizza_madre_id,
  COALESCE(q.appendice, t.appendice) AS appendice_tipo,
  rn.numero_rata,
  rn.numero_rate_totali,
  t.ufficio_id,
  COALESCE(t.ae_anagrafica_id, p.account_executive_anagrafica_id) AS ae_anagrafica_id,
  COALESCE(t.anagrafica_commerciale_id, p.anagrafica_commerciale_id) AS anagrafica_commerciale_id,
  p.produttore_anagrafica_id AS produttore_id,
  t.tipo_pagamento
FROM public.titoli t
LEFT JOIN LATERAL (
  SELECT m1.id, m1.garanzia_da, m1.frazionamento, m1.polizza_id
  FROM public.titoli m1
  WHERE t.sostituisce_polizza IS NOT NULL
    AND m1.numero_titolo = t.sostituisce_polizza
    AND m1.sostituisce_polizza IS NULL
  ORDER BY
    (m1.compagnia_id IS NOT DISTINCT FROM t.compagnia_id) DESC,
    (m1.garanzia_da <= t.garanzia_da) DESC NULLS LAST,
    m1.garanzia_da DESC NULLS LAST
  LIMIT 1
) m ON true
LEFT JOIN LATERAL (
  SELECT q1.id, q1.stato, q1.numero_polizza_snapshot, q1.appendice, q1.polizza_id
  FROM public.quietanze q1
  WHERE q1.titolo_id = t.id
  ORDER BY q1.numero_rata NULLS LAST
  LIMIT 1
) q ON true
LEFT JOIN LATERAL (
  SELECT p1.*
  FROM public.polizze p1
  WHERE p1.id = COALESCE(
    t.polizza_id,
    q.polizza_id,
    m.polizza_id,
    (SELECT p2.id FROM public.polizze p2 WHERE p2.titolo_madre_id = COALESCE(m.id, t.id) LIMIT 1)
  )
) p ON true
LEFT JOIN LATERAL (
  SELECT CASE
    WHEN lower(COALESCE(t.frazionamento, m.frazionamento, '')) LIKE 'mens%' THEN 12
    WHEN lower(COALESCE(t.frazionamento, m.frazionamento, '')) LIKE 'bimes%' THEN 6
    WHEN lower(COALESCE(t.frazionamento, m.frazionamento, '')) LIKE 'trim%' THEN 4
    WHEN lower(COALESCE(t.frazionamento, m.frazionamento, '')) LIKE 'quadr%' THEN 3
    WHEN lower(COALESCE(t.frazionamento, m.frazionamento, '')) LIKE 'sem%' THEN 2
    WHEN lower(COALESCE(t.frazionamento, m.frazionamento, '')) ~ '^(ann|unic|rata unic|tempor)' THEN 1
    ELSE GREATEST(COALESCE(t.rate, 1), 1)
  END AS n
) fr ON true
LEFT JOIN LATERAL (
  SELECT
    CASE
      WHEN t.sostituisce_polizza IS NULL
        OR COALESCE(t.is_regolazione, false)
        OR COALESCE(t.is_proroga, false)
        OR COALESCE(t.is_appendice_modifica, false)
        THEN 1
      WHEN m.garanzia_da IS NULL OR t.garanzia_da IS NULL OR fr.n <= 1 THEN 1
      ELSE (
        floor(
          GREATEST(
            extract(year FROM age(t.garanzia_da, m.garanzia_da)) * 12
              + extract(month FROM age(t.garanzia_da, m.garanzia_da))
              + round(extract(day FROM age(t.garanzia_da, m.garanzia_da)) / 30.0),
            0
          ) / (12.0 / fr.n)
        )::int % fr.n
      ) + 1
    END::integer AS numero_rata,
    CASE
      WHEN COALESCE(t.is_regolazione, false)
        OR COALESCE(t.is_proroga, false)
        OR COALESCE(t.is_appendice_modifica, false)
        THEN 1
      ELSE fr.n
    END::integer AS numero_rate_totali
) rn ON true
LEFT JOIN public.clienti cli ON cli.id = t.cliente_anagrafica_id
LEFT JOIN public.compagnie comp ON comp.id = t.compagnia_id
LEFT JOIN public.rami r ON r.id = t.ramo_id
WHERE
  -- madre nascosta solo se la copia 1/1 è incassata e la madre no
  NOT (
    t.sostituisce_polizza IS NULL
    AND COALESCE(t.stato, '') <> 'incassato'
    AND EXISTS (
      SELECT 1 FROM public.titoli c
      WHERE c.sostituisce_polizza = t.numero_titolo
        AND c.compagnia_id IS NOT DISTINCT FROM t.compagnia_id
        AND c.garanzia_da IS NOT DISTINCT FROM t.garanzia_da
        AND abs(COALESCE(c.premio_lordo, 0) - COALESCE(t.premio_lordo, 0)) < 0.02
        AND NOT COALESCE(c.is_regolazione, false)
        AND NOT COALESCE(c.is_proroga, false)
        AND NOT COALESCE(c.is_appendice_modifica, false)
        AND c.stato = 'incassato'
    )
  )
  -- copia 1/1 nascosta salvo che porti l'unico incasso
  AND NOT (
    t.sostituisce_polizza IS NOT NULL
    AND NOT COALESCE(t.is_regolazione, false)
    AND NOT COALESCE(t.is_proroga, false)
    AND NOT COALESCE(t.is_appendice_modifica, false)
    AND EXISTS (
      SELECT 1 FROM public.titoli mm
      WHERE mm.numero_titolo = t.sostituisce_polizza
        AND mm.sostituisce_polizza IS NULL
        AND mm.compagnia_id IS NOT DISTINCT FROM t.compagnia_id
        AND mm.garanzia_da IS NOT DISTINCT FROM t.garanzia_da
        AND abs(COALESCE(mm.premio_lordo, 0) - COALESCE(t.premio_lordo, 0)) < 0.02
        AND (mm.stato = 'incassato' OR COALESCE(t.stato, '') <> 'incassato')
    )
  );

COMMENT ON VIEW public.v_portafoglio_quietanze IS
  'Incassi/Carico/Attive/Storico: una riga per titolo, stato e messa a cassa da titoli. polizze/quietanze legacy solo come join opzionali.';

GRANT SELECT ON public.v_portafoglio_quietanze TO anon, authenticated, service_role;
