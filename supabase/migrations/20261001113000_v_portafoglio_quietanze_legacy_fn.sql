-- v_portafoglio_quietanze: i join opzionali su polizze/quietanze legacy, con le
-- RLS per sede, sotto PostgREST (piano generico) degeneravano in seq scan
-- per riga → statement timeout su Incassi. Il lookup passa da una funzione
-- plpgsql (SECURITY INVOKER: RLS invariata) che usa sempre gli indici.

CREATE OR REPLACE FUNCTION public.fn_vpq_legacy(
  p_titolo_id uuid,
  p_polizza_id uuid,
  p_madre_id uuid,
  p_madre_polizza_id uuid
)
RETURNS TABLE (
  quietanza_id uuid,
  stato_quietanza public.quietanza_stato,
  numero_polizza_snapshot text,
  appendice text,
  polizza_id uuid,
  cig_rif text,
  appendice_corrente text,
  stato_polizza public.polizza_stato,
  account_executive_anagrafica_id uuid,
  anagrafica_commerciale_id uuid,
  produttore_anagrafica_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_q_polizza uuid;
  v_pid uuid;
BEGIN
  SELECT q.id, q.stato, q.numero_polizza_snapshot, q.appendice, q.polizza_id
    INTO quietanza_id, stato_quietanza, numero_polizza_snapshot, appendice, v_q_polizza
  FROM quietanze q
  WHERE q.titolo_id = p_titolo_id
  ORDER BY q.numero_rata NULLS LAST
  LIMIT 1;

  v_pid := COALESCE(p_polizza_id, v_q_polizza, p_madre_polizza_id);
  IF v_pid IS NULL THEN
    SELECT p2.id INTO v_pid
    FROM polizze p2
    WHERE p2.titolo_madre_id = COALESCE(p_madre_id, p_titolo_id)
    LIMIT 1;
  END IF;

  IF v_pid IS NOT NULL THEN
    SELECT p.id, p.cig_rif, p.appendice_corrente, p.stato,
           p.account_executive_anagrafica_id, p.anagrafica_commerciale_id, p.produttore_anagrafica_id
      INTO polizza_id, cig_rif, appendice_corrente, stato_polizza,
           account_executive_anagrafica_id, anagrafica_commerciale_id, produttore_anagrafica_id
    FROM polizze p
    WHERE p.id = v_pid;
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_vpq_legacy(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_vpq_legacy(uuid, uuid, uuid, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.v_portafoglio_quietanze
WITH (security_invoker = true) AS
SELECT
  t.id,
  lg.quietanza_id,
  lg.polizza_id,
  t.id AS titolo_legacy_id,
  COALESCE(t.sostituisce_polizza, t.numero_titolo) AS numero_titolo,
  t.numero_titolo AS titolo_derivato_numero,
  lg.numero_polizza_snapshot,
  COALESCE(t.cig_rif, lg.cig_rif) AS cig_rif,
  lg.appendice_corrente,
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
  lg.stato_quietanza,
  lg.stato_polizza,
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
  COALESCE(lg.appendice, t.appendice) AS appendice_tipo,
  rn.numero_rata,
  rn.numero_rate_totali,
  t.ufficio_id,
  COALESCE(t.ae_anagrafica_id, lg.account_executive_anagrafica_id) AS ae_anagrafica_id,
  COALESCE(t.anagrafica_commerciale_id, lg.anagrafica_commerciale_id) AS anagrafica_commerciale_id,
  lg.produttore_anagrafica_id AS produttore_id,
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
LEFT JOIN LATERAL public.fn_vpq_legacy(t.id, t.polizza_id, m.id, m.polizza_id) lg ON true
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

GRANT SELECT ON public.v_portafoglio_quietanze TO anon, authenticated, service_role;
