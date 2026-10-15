-- Numero appendice libero (alfanumerico) ma univoco per polizza madre (appendici_polizza.titolo_id).
-- Stesso cliente, polizze diverse: possono riusare lo stesso numero appendice.

CREATE OR REPLACE FUNCTION public.check_numero_appendice_univoco_polizza()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.numero_appendice := nullif(btrim(NEW.numero_appendice), '');
  IF NEW.numero_appendice IS NULL THEN
    RAISE EXCEPTION 'Numero appendice obbligatorio';
  END IF;
  IF TG_OP = 'UPDATE'
     AND upper(NEW.numero_appendice) = upper(btrim(coalesce(OLD.numero_appendice, '')))
     AND NEW.titolo_id IS NOT DISTINCT FROM OLD.titolo_id THEN
    RETURN NEW;
  END IF;

  IF NEW.titolo_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM appendici_polizza a
     WHERE a.id IS DISTINCT FROM NEW.id
       AND a.titolo_id = NEW.titolo_id
       AND upper(btrim(a.numero_appendice)) = upper(NEW.numero_appendice)
  ) THEN
    RAISE EXCEPTION 'Numero appendice "%" già usato per un''altra appendice di questa polizza', NEW.numero_appendice
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_numero_appendice_univoco_polizza() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_numero_appendice_univoco_cliente ON public.appendici_polizza;
DROP FUNCTION IF EXISTS public.check_numero_appendice_univoco_cliente();

CREATE TRIGGER trg_numero_appendice_univoco_polizza
  BEFORE INSERT OR UPDATE OF numero_appendice, titolo_id ON public.appendici_polizza
  FOR EACH ROW EXECUTE FUNCTION public.check_numero_appendice_univoco_polizza();
