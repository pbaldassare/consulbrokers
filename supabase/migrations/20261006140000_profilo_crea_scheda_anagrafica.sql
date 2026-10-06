-- Utenti commerciali: alla creazione (o al cambio ruolo) dell'utente in `profiles`
-- si crea la scheda in `anagrafiche_professionali`, così compare in Anagrafiche
-- Amministrative e nelle tendine Produttore/Resp. Sede. Collegamento per email.
--   responsabile_sede -> scheda tipo responsabile_sede
--   corrispondente / produttore -> scheda tipo corrispondente (= "Produttore" in UI)
-- Se esiste già una scheda con la stessa email, si aggiunge solo il ruolo mancante.

CREATE OR REPLACE FUNCTION private.profilo_crea_scheda_anagrafica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tipo text;
  v_email text := lower(btrim(NEW.email));
  v_id uuid;
BEGIN
  v_tipo := CASE NEW.ruolo
    WHEN 'responsabile_sede' THEN 'responsabile_sede'
    WHEN 'corrispondente' THEN 'corrispondente'
    WHEN 'produttore' THEN 'corrispondente'
  END;
  IF v_tipo IS NULL OR coalesce(v_email, '') = '' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_id
  FROM public.anagrafiche_professionali
  WHERE lower(btrim(email)) = v_email
  ORDER BY attivo DESC, created_at
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.anagrafiche_professionali
       SET ruoli = array_append(coalesce(ruoli, '{}'), v_tipo)
     WHERE id = v_id
       AND NOT (v_tipo = ANY (coalesce(ruoli, '{}')));
    RETURN NEW;
  END IF;

  INSERT INTO public.anagrafiche_professionali
    (tipo, ruoli, attivo, annullato, cognome, nome, ragione_sociale, email, telefono, ufficio_id,
     percentuale_base, percentuale_ra, percentuale_consulenza, trattenuta_provvigioni_incasso, note)
  VALUES
    (v_tipo, ARRAY[v_tipo], coalesce(NEW.attivo, true), false,
     nullif(btrim(NEW.cognome), ''), nullif(btrim(NEW.nome), ''),
     coalesce(nullif(btrim(concat_ws(' ', NEW.cognome, NEW.nome)), ''), NEW.email),
     NEW.email, NEW.telefono, NEW.ufficio_id,
     0, 4.60, 0, false,
     'Creata automaticamente dall''utente ' || NEW.email || ' il ' || to_char(now(), 'DD/MM/YYYY'));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.profilo_crea_scheda_anagrafica() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_profilo_crea_scheda_anagrafica ON public.profiles;
CREATE TRIGGER trg_profilo_crea_scheda_anagrafica
  AFTER INSERT OR UPDATE OF ruolo ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.profilo_crea_scheda_anagrafica();
