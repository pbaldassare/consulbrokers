-- Lo stesso numero polizza puo' esistere su clienti diversi
-- (es. VIS nidificati Roma Uno 3211620).
DROP INDEX IF EXISTS public.titoli_no_duplicati_rinnovo;
CREATE UNIQUE INDEX titoli_no_duplicati_rinnovo
  ON public.titoli (numero_titolo, compagnia_id, data_scadenza, cliente_anagrafica_id)
  WHERE numero_titolo IS NOT NULL
    AND data_scadenza IS NOT NULL
    AND sostituisce_polizza IS NULL;
