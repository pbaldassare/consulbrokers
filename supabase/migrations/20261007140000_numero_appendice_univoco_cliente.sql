-- Numero appendice libero (alfanumerico) ma univoco per cliente: due clienti diversi possono usare lo stesso numero.
-- Confronto senza spazi ai lati e senza distinzione maiuscole/minuscole.
-- Vale solo per nuove appendici e per i numeri modificati: i doppioni storici (numerazione per polizza) restano.
CREATE OR REPLACE FUNCTION public.check_numero_appendice_univoco_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ana uuid;
  v_cli uuid;
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

  SELECT cliente_anagrafica_id, cliente_id INTO v_ana, v_cli FROM titoli WHERE id = NEW.titolo_id;
  IF v_ana IS NULL AND v_cli IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM appendici_polizza a
      JOIN titoli t ON t.id = a.titolo_id
     WHERE a.id IS DISTINCT FROM NEW.id
       AND upper(btrim(a.numero_appendice)) = upper(NEW.numero_appendice)
       AND (CASE WHEN v_ana IS NOT NULL THEN t.cliente_anagrafica_id = v_ana ELSE t.cliente_id = v_cli END)
  ) THEN
    RAISE EXCEPTION 'Numero appendice "%" già usato per un''altra appendice di questo cliente', NEW.numero_appendice
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_numero_appendice_univoco_cliente() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_numero_appendice_univoco_cliente ON public.appendici_polizza;
CREATE TRIGGER trg_numero_appendice_univoco_cliente
  BEFORE INSERT OR UPDATE OF numero_appendice, titolo_id ON public.appendici_polizza
  FOR EACH ROW EXECUTE FUNCTION public.check_numero_appendice_univoco_cliente();
