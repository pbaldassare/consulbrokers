
-- ============================================================
-- 1. Update v_portafoglio_titoli view with calculated fields
--    for renewal period and premium immutability
-- ============================================================

CREATE OR REPLACE VIEW public.v_portafoglio_titoli AS
SELECT 
  t.id,
  t.numero_titolo,
  t.cliente_id,
  t.prodotto_id,
  t.ufficio_id,
  t.produttore_id,
  t.premio_lordo,
  t.importo_incassato,
  t.data_incasso,
  t.stato,
  t.note,
  t.created_at,
  t.updated_at,
  t.search_vector,
  t.cliente_anagrafica_id,
  t.data_scadenza,
  t.compagnia_id,
  t.ramo_id,
  t.gruppo_ramo,
  t.specialist,
  t.tipo_portafoglio,
  t.cig_rif,
  t.vincolo,
  t.descrizione_polizza,
  t.appendice,
  t.riga,
  t.targa_telaio,
  t.durata_da,
  t.durata_a,
  t.anni_durata,
  t.garanzia_da,
  t.garanzia_a,
  t.data_competenza,
  t.limite_mora,
  t.mora_giorni,
  t.rate,
  t.tipo_rinnovo,
  t.disdetta_mesi,
  t.regolazione,
  t.tipo_lettera_regolazione,
  t.tipo_scadenza,
  t.giorni_presentazione,
  t.periodicita,
  t.libro_matricola,
  t.rimborso,
  t.valuta,
  t.cambio,
  t.indicizzata,
  t.no_calcolo_tasse,
  t.premio_netto,
  t.addizionali,
  t.tasse,
  t.provvigioni_firma,
  t.provvigioni_quietanza,
  t.premio_netto_quietanza,
  t.addizionali_quietanza,
  t.tasse_quietanza,
  t.pag_diretto_compagnia,
  t.emissione_fee,
  t.formato_elettronico,
  t.sostituisce_polizza,
  t.sostituisce_riga,
  t.sostituisce_appendice,
  t.storno_polizza,
  t.storno_riga,
  t.storno_appendice,
  t.commerciale_id,
  t.percentuale_commerciale,
  t.percentuale_riparto,
  t.tipo_mandatario,
  t.risk_type,
  t.prodotto_nome,
  t.comp_contabile,
  t.comp_assicurativa,
  t.tipo_incasso,
  t.conto_incasso,
  t.id_legacy,
  t.produttore_nome,
  t.ae_nome,
  t.filiale,
  t.data_sospensione,
  t.limite_riattivazione,
  t.data_riattivazione,
  t.motivo_sospensione,
  t.data_messa_cassa,
  t.data_pagamento,
  t.data_decorrenza_rinnovo,
  t.conferimento_gestito,
  t.fondi_ricevuti,
  t.data_conferimento_gestito,
  c.nome AS compagnia_nome,
  c.codice AS compagnia_codice,
  r.descrizione AS ramo_nome,
  r.codice AS ramo_codice,
  COALESCE(cl.ragione_sociale, TRIM(BOTH FROM (COALESCE(cl.cognome, ''::text) || ' '::text) || COALESCE(cl.nome, ''::text))) AS cliente_nome_display,
  cl.codice_ricerca AS cliente_codice,
  cl.cognome AS cliente_cognome,
  cl.nome AS cliente_nome,
  cl.ragione_sociale AS cliente_ragione_sociale,
  cl.codice_fiscale AS cliente_codice_fiscale,
  cl.tipo_cliente AS cliente_tipo,
  u.nome_ufficio,
  -- ===== NEW CALCULATED FIELDS: NEXT COVERAGE PERIOD =====
  CASE 
    WHEN t.garanzia_a IS NOT NULL THEN (t.garanzia_a + INTERVAL '1 day')::date
    ELSE NULL
  END AS prossima_garanzia_da,
  CASE 
    WHEN t.garanzia_a IS NULL THEN NULL
    WHEN t.rate = 1  THEN (t.garanzia_a + INTERVAL '1 day' + INTERVAL '12 months' - INTERVAL '1 day')::date
    WHEN t.rate = 2  THEN (t.garanzia_a + INTERVAL '1 day' + INTERVAL '6 months'  - INTERVAL '1 day')::date
    WHEN t.rate = 3  THEN (t.garanzia_a + INTERVAL '1 day' + INTERVAL '4 months'  - INTERVAL '1 day')::date
    WHEN t.rate = 4  THEN (t.garanzia_a + INTERVAL '1 day' + INTERVAL '3 months'  - INTERVAL '1 day')::date
    WHEN t.rate = 12 THEN (t.garanzia_a + INTERVAL '1 day' + INTERVAL '1 month'   - INTERVAL '1 day')::date
    ELSE (t.garanzia_a + INTERVAL '1 day' + INTERVAL '12 months' - INTERVAL '1 day')::date
  END AS prossima_garanzia_a,
  CASE 
    WHEN t.garanzia_a IS NOT NULL THEN to_char(t.garanzia_a + INTERVAL '1 day', 'YYYY-MM')
    ELSE NULL
  END AS mese_carico,
  -- ===== PREMI MODIFICABILI =====
  -- false se: garanzia_a < oggi - 7gg AND stato = 'incassato'
  -- true negli altri casi (modificabile)
  NOT (
    t.garanzia_a IS NOT NULL
    AND t.garanzia_a < (CURRENT_DATE - INTERVAL '7 days')::date
    AND t.stato = 'incassato'
  ) AS premi_modificabili
FROM titoli t
  LEFT JOIN compagnie c ON c.id = t.compagnia_id
  LEFT JOIN rami r ON r.id = t.ramo_id
  LEFT JOIN prodotti p ON p.id = t.prodotto_id
  LEFT JOIN clienti cl ON cl.id = t.cliente_anagrafica_id
  LEFT JOIN uffici u ON u.id = t.ufficio_id;

-- ============================================================
-- 2. Trigger of safety: block premium updates on historical titoli
-- ============================================================

CREATE OR REPLACE FUNCTION public.lock_premi_storici()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bypass text;
  v_changed boolean := false;
BEGIN
  -- bypass admin via session setting
  v_bypass := current_setting('app.bypass_premi_lock', true);
  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  -- Only lock when garanzia_a is past (>7 days ago) AND already incassato
  IF OLD.garanzia_a IS NULL 
     OR OLD.garanzia_a >= (CURRENT_DATE - INTERVAL '7 days')::date
     OR OLD.stato <> 'incassato' THEN
    RETURN NEW;
  END IF;

  -- Detect changes to monetary fields
  IF NEW.premio_netto IS DISTINCT FROM OLD.premio_netto THEN v_changed := true; END IF;
  IF NEW.addizionali IS DISTINCT FROM OLD.addizionali THEN v_changed := true; END IF;
  IF NEW.tasse IS DISTINCT FROM OLD.tasse THEN v_changed := true; END IF;
  IF NEW.premio_lordo IS DISTINCT FROM OLD.premio_lordo THEN v_changed := true; END IF;
  IF NEW.provvigioni_firma IS DISTINCT FROM OLD.provvigioni_firma THEN v_changed := true; END IF;
  IF NEW.provvigioni_quietanza IS DISTINCT FROM OLD.provvigioni_quietanza THEN v_changed := true; END IF;
  IF NEW.premio_netto_quietanza IS DISTINCT FROM OLD.premio_netto_quietanza THEN v_changed := true; END IF;
  IF NEW.addizionali_quietanza IS DISTINCT FROM OLD.addizionali_quietanza THEN v_changed := true; END IF;
  IF NEW.tasse_quietanza IS DISTINCT FROM OLD.tasse_quietanza THEN v_changed := true; END IF;

  IF v_changed THEN
    RAISE EXCEPTION 'Premi non modificabili: il periodo di copertura (% - %) è chiuso e la polizza è incassata. Crea un''appendice o sblocca temporaneamente come admin.',
      OLD.garanzia_da, OLD.garanzia_a;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_premi_storici ON public.titoli;
CREATE TRIGGER trg_lock_premi_storici
  BEFORE UPDATE ON public.titoli
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_premi_storici();
