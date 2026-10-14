-- Nome compagnia digitato a mano sul singolo sinistro (--Non identificato--).
-- Isolato: non è un record in compagnie / compagnia_rapporti / anagrafiche.
ALTER TABLE public.sinistri
  ADD COLUMN IF NOT EXISTS compagnia_libera text;

COMMENT ON COLUMN public.sinistri.compagnia_libera IS
  'Nome compagnia libero sul singolo sinistro (opzione --Non identificato--). Non è un record in anagrafica compagnie.';
