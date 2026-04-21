-- ============================================================================
-- 1. Tabella di backup per audit
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.titoli_garanzia_legacy_backup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id UUID NOT NULL,
  garanzia_a_old DATE,
  garanzia_a_new DATE,
  data_scadenza DATE,
  motivo TEXT NOT NULL,
  eseguito_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  eseguito_da UUID
);

ALTER TABLE public.titoli_garanzia_legacy_backup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read backup garanzia" ON public.titoli_garanzia_legacy_backup;
CREATE POLICY "Admin can read backup garanzia"
ON public.titoli_garanzia_legacy_backup
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ruolo IN ('admin','responsabile_sede')
  )
);

CREATE INDEX IF NOT EXISTS idx_garanzia_backup_titolo ON public.titoli_garanzia_legacy_backup(titolo_id);

-- ============================================================================
-- 2. Snapshot + UPDATE dei record disallineati
-- ============================================================================
DO $$
BEGIN
  -- Bypass del trigger lock_premi_storici (non tocchiamo premi, ma per sicurezza)
  PERFORM set_config('app.bypass_premi_lock', 'on', true);

  -- Snapshot
  INSERT INTO public.titoli_garanzia_legacy_backup (titolo_id, garanzia_a_old, garanzia_a_new, data_scadenza, motivo)
  SELECT 
    t.id,
    t.garanzia_a,
    t.data_scadenza,
    t.data_scadenza,
    'Allineamento legacy: garanzia_a fine mese > data_scadenza di ' || (t.garanzia_a - t.data_scadenza) || ' giorni'
  FROM public.titoli t
  WHERE t.garanzia_a IS NOT NULL
    AND t.data_scadenza IS NOT NULL
    AND t.garanzia_a > t.data_scadenza
    AND (t.garanzia_a - t.data_scadenza) BETWEEN 1 AND 31;

  -- UPDATE
  UPDATE public.titoli
  SET garanzia_a = data_scadenza
  WHERE garanzia_a IS NOT NULL
    AND data_scadenza IS NOT NULL
    AND garanzia_a > data_scadenza
    AND (garanzia_a - data_scadenza) BETWEEN 1 AND 31;
END $$;

-- ============================================================================
-- 3. Trigger di safety: previene future incoerenze
-- ============================================================================
CREATE OR REPLACE FUNCTION public.align_garanzia_a()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.data_scadenza IS NOT NULL THEN
    -- garanzia_a NULL → allinea a data_scadenza
    IF NEW.garanzia_a IS NULL THEN
      NEW.garanzia_a := NEW.data_scadenza;
    -- garanzia_a oltre data_scadenza ma entro 31 giorni → allinea
    ELSIF NEW.garanzia_a > NEW.data_scadenza + INTERVAL '3 days'
      AND (NEW.garanzia_a - NEW.data_scadenza) <= 31 THEN
      NEW.garanzia_a := NEW.data_scadenza;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_align_garanzia_a ON public.titoli;
CREATE TRIGGER trg_align_garanzia_a
BEFORE INSERT OR UPDATE OF garanzia_a, data_scadenza ON public.titoli
FOR EACH ROW
EXECUTE FUNCTION public.align_garanzia_a();

-- ============================================================================
-- 4. Vista v_portafoglio_titoli aggiornata con fine_periodo_effettivo
-- ============================================================================
DROP VIEW IF EXISTS public.v_portafoglio_titoli CASCADE;

CREATE VIEW public.v_portafoglio_titoli AS
WITH base AS (
  SELECT 
    t.*,
    -- fine periodo effettivo: il più piccolo tra garanzia_a e data_scadenza (difensivo)
    LEAST(
      COALESCE(t.garanzia_a, t.data_scadenza, t.durata_a),
      COALESCE(t.data_scadenza, t.garanzia_a, t.durata_a)
    ) AS fine_periodo_effettivo
  FROM public.titoli t
)
SELECT
  b.*,
  -- Cliente display name
  COALESCE(c.ragione_sociale, NULLIF(TRIM(COALESCE(c.cognome,'') || ' ' || COALESCE(c.nome,'')), '')) AS cliente_nome_display,
  c.codice_fiscale AS cliente_codice_fiscale,
  c.partita_iva AS cliente_partita_iva,
  c.tipo_cliente AS cliente_tipo,
  -- Compagnia
  comp.nome AS compagnia_nome,
  comp.codice AS compagnia_codice,
  -- Ramo
  r.descrizione AS ramo_descrizione,
  r.codice AS ramo_codice,
  -- Ufficio
  uff.nome_ufficio AS ufficio_nome,
  -- Prossimo periodo (basato su fine_periodo_effettivo)
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
  -- Premi modificabili: false se fine periodo > 7gg fa AND incassato
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

-- Permessi sulla vista
GRANT SELECT ON public.v_portafoglio_titoli TO authenticated;
GRANT SELECT ON public.v_portafoglio_titoli TO anon;