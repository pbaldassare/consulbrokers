-- Colonne mandato EXE (direzione/pluri/broker) sulla mappa compagnie.

ALTER TABLE public.roma_exe_compagnie_map
  ADD COLUMN IF NOT EXISTS tipo_mandato text,
  ADD COLUMN IF NOT EXISTS exe_aggiuntiva text,
  ADD COLUMN IF NOT EXISTS controparte_id uuid REFERENCES public.compagnie(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rapporto_id uuid REFERENCES public.compagnia_rapporti(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS roma_exe_compagnie_map_controparte_idx
  ON public.roma_exe_compagnie_map (controparte_id);

CREATE INDEX IF NOT EXISTS roma_exe_compagnie_map_rapporto_idx
  ON public.roma_exe_compagnie_map (rapporto_id);

COMMENT ON COLUMN public.roma_exe_compagnie_map.tipo_mandato IS
  'Mandato EXE: direzione | pluri | broker.';
