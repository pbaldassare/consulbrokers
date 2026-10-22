-- Mapping elenco clienti gestionale Roma Uno → anagrafiche CBnet.
-- Serve a collegare i codici Excel senza doppioni (match per CF/P.IVA).

CREATE TABLE IF NOT EXISTS public.roma_uno_clienti_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  excel_codice text NOT NULL,
  excel_ragione_sociale text,
  cliente_id uuid REFERENCES public.clienti(id) ON DELETE SET NULL,
  esito text NOT NULL CHECK (esito IN ('esistente', 'creata', 'saltata')),
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (excel_codice)
);

CREATE INDEX IF NOT EXISTS roma_uno_clienti_map_cliente_idx
  ON public.roma_uno_clienti_map (cliente_id);

ALTER TABLE public.roma_uno_clienti_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roma_uno_clienti_map_select" ON public.roma_uno_clienti_map;
CREATE POLICY "roma_uno_clienti_map_select"
  ON public.roma_uno_clienti_map
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "roma_uno_clienti_map_admin_write" ON public.roma_uno_clienti_map;
CREATE POLICY "roma_uno_clienti_map_admin_write"
  ON public.roma_uno_clienti_map
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.roma_uno_clienti_map IS
  'Collegamento codice cliente Excel Roma Uno → anagrafica CBnet (sede 009, senza doppioni).';
