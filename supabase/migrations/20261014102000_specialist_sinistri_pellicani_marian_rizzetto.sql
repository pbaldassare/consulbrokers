-- Responsabili interni sinistri: Anna Pellicani, Eleonora Marian, Enrico Rizzetto.
-- Sono già utenti attivi (ruolo ufficio) della sede San Donà di Piave.
-- Il filtro e l'apertura pratica elencano solo chi è in specialist_sinistri_sedi:
-- prima comparivano solo Di Lorenzo e Midena.
-- Idempotente: lookup per email e codice sede, nessun UUID.

DO $$
DECLARE
  v_sede uuid;
  v_missing text;
BEGIN
  SELECT id INTO v_sede
  FROM public.uffici
  WHERE codice_ufficio = 'SD'
  LIMIT 1;

  IF v_sede IS NULL THEN
    RAISE EXCEPTION 'Sede San Donà (SD) non trovata';
  END IF;

  SELECT string_agg(e, ', ') INTO v_missing
  FROM unnest(ARRAY[
    'apellicani@consulbrokers.it',
    'eleonoramarian@consulbrokers.it',
    'erizzetto@consulbrokers.it'
  ]) AS e
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(p.email) = e AND p.attivo IS TRUE
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Profili attivi mancanti: %', v_missing;
  END IF;

  INSERT INTO public.specialist_sinistri_sedi (profilo_id, ufficio_id, primaria)
  SELECT p.id, v_sede, true
  FROM public.profiles p
  WHERE lower(p.email) IN (
    'apellicani@consulbrokers.it',
    'eleonoramarian@consulbrokers.it',
    'erizzetto@consulbrokers.it'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.specialist_sinistri_sedi s
    WHERE s.profilo_id = p.id AND s.ufficio_id = v_sede
  );
END $$;
