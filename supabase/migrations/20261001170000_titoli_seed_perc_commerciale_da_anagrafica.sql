-- Import sedi (PIPQ) scriveva anagrafica_commerciale_id ma non percentuale_commerciale:
-- scattava il DEFAULT 100 anche per produttori con percentuale_base 40 (es. Interfidi).
-- Su INSERT, se la % è assente o è il default 100, usa percentuale_base dell'anagrafica.

CREATE OR REPLACE FUNCTION public.titoli_seed_percentuale_commerciale()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_base numeric;
BEGIN
  IF NEW.anagrafica_commerciale_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.percentuale_commerciale IS NOT NULL
     AND ABS(NEW.percentuale_commerciale - 100) >= 0.01 THEN
    RETURN NEW;
  END IF;
  SELECT ap.percentuale_base
    INTO v_base
  FROM public.anagrafiche_professionali ap
  WHERE ap.id = NEW.anagrafica_commerciale_id;
  IF v_base IS NOT NULL AND v_base > 0 THEN
    NEW.percentuale_commerciale := v_base;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_titoli_seed_percentuale_commerciale ON public.titoli;
CREATE TRIGGER trg_titoli_seed_percentuale_commerciale
BEFORE INSERT ON public.titoli
FOR EACH ROW
EXECUTE FUNCTION public.titoli_seed_percentuale_commerciale();
