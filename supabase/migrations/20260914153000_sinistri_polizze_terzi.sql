-- Sinistri Terzi: contenitore leggero per polizze NON del portafoglio CBnet.
--
-- Un "Sinistro Terzi" (sinistri.sinistro_terzi = true) riguarda una polizza che
-- non e' nel nostro portafoglio (es. polizze del Comune di Varese intermediate da
-- un altro broker). Questi dati vanno gestiti "come se fossero polizze vere" ma:
--   * niente collegamento a `titoli` (resta titolo_id NULL);
--   * meno regole (pochi vincoli, RLS semplice, nessuna logica di sede/provvigioni);
--   * fuori dal portafoglio: essendo una tabella separata da `titoli`, non compare
--     mai nelle viste v_portafoglio_* (isolamento by design, nessun filtro da aggiungere).

CREATE TABLE IF NOT EXISTS public.polizze_terzi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_polizza text,
  compagnia_id uuid REFERENCES public.compagnie(id) ON DELETE SET NULL,
  compagnia_nome text,
  contraente text,
  cliente_anagrafica_id uuid REFERENCES public.clienti(id) ON DELETE SET NULL,
  garanzia_principale text,
  broker_riferimento text,
  ramo text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT polizze_terzi_almeno_un_dato CHECK (
    numero_polizza IS NOT NULL
    OR compagnia_id IS NOT NULL
    OR compagnia_nome IS NOT NULL
    OR contraente IS NOT NULL
  )
);

COMMENT ON TABLE public.polizze_terzi IS
  'Polizze non-CBnet collegate a Sinistri Terzi. Fuori portafoglio, regole minime.';

CREATE INDEX IF NOT EXISTS idx_polizze_terzi_numero
  ON public.polizze_terzi (numero_polizza);
CREATE INDEX IF NOT EXISTS idx_polizze_terzi_cliente
  ON public.polizze_terzi (cliente_anagrafica_id);

-- updated_at automatico (funzione condivisa gia' presente in schema)
DROP TRIGGER IF EXISTS trg_polizze_terzi_updated ON public.polizze_terzi;
CREATE TRIGGER trg_polizze_terzi_updated
  BEFORE UPDATE ON public.polizze_terzi
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Aggancio dal sinistro alla polizza terzi
ALTER TABLE public.sinistri
  ADD COLUMN IF NOT EXISTS polizza_terzi_id uuid
  REFERENCES public.polizze_terzi(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sinistri.polizza_terzi_id IS
  'Polizza non-CBnet (Sinistro Terzi). Valorizzato solo quando sinistro_terzi = true.';

-- Coerenza: la polizza terzi e' ammessa solo sui sinistri terzi
ALTER TABLE public.sinistri
  DROP CONSTRAINT IF EXISTS sinistri_polizza_terzi_solo_terzi_check;
ALTER TABLE public.sinistri
  ADD CONSTRAINT sinistri_polizza_terzi_solo_terzi_check
  CHECK (
    polizza_terzi_id IS NULL
    OR sinistro_terzi = true
  );

-- RLS: come le altre entita' sinistri ma senza logica di sede (la polizza non e' nostra)
ALTER TABLE public.polizze_terzi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all polizze terzi"
  ON public.polizze_terzi
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "CFO select polizze terzi"
  ON public.polizze_terzi
  FOR SELECT
  USING (has_role(auth.uid(), 'cfo'::app_role));

CREATE POLICY "Ufficio all polizze terzi"
  ON public.polizze_terzi
  FOR ALL
  USING (has_role(auth.uid(), 'ufficio'::app_role))
  WITH CHECK (has_role(auth.uid(), 'ufficio'::app_role));

-- Lettura per qualsiasi utente autenticato (dati non sensibili, coerente con "meno regole")
CREATE POLICY "Auth select polizze terzi"
  ON public.polizze_terzi
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.polizze_terzi TO authenticated;
GRANT ALL ON public.polizze_terzi TO service_role;
