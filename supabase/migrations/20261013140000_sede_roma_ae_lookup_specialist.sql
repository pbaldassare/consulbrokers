-- SEDE ROMA diventa anche Account Executive (stesso record, come Sede Basilicata).
-- Le tendine AE usano ruoli @> account_executive; senza questo ruolo non compare.
UPDATE public.anagrafiche_professionali
SET ruoli = CASE
      WHEN ruoli @> ARRAY['account_executive']::text[] THEN ruoli
      ELSE array_append(COALESCE(ruoli, ARRAY[]::text[]), 'account_executive')
    END
WHERE attivo
  AND codice = 'RM'
  AND ragione_sociale ILIKE 'SEDE ROMA';

-- Tendine specialist: ufficio_id in elenco così la sede si eredita senza query RLS su profiles.
CREATE OR REPLACE FUNCTION public.lookup_intermediari()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Elenco riservato al personale interno' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'uffici', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome_ufficio', nome_ufficio, 'codice_ufficio', codice_ufficio) ORDER BY nome_ufficio), '[]')
                 FROM uffici WHERE attivo),
    'produttori', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'codice', codice, 'cognome', cognome, 'nome', nome, 'sigla', sigla,
                                                             'ragione_sociale', ragione_sociale, 'tipo', tipo, 'percentuale_base', percentuale_base) ORDER BY cognome), '[]')
                     FROM anagrafiche_professionali
                    WHERE attivo AND ruoli && ARRAY['account_executive', 'corrispondente', 'responsabile_sede']),
    'account_executive', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'cognome', cognome, 'ragione_sociale', ragione_sociale,
                                                                     'sigla', sigla, 'codice', codice)), '[]')
                            FROM anagrafiche_professionali WHERE attivo AND ruoli @> ARRAY['account_executive']),
    'specialist', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'cognome', cognome, 'ruolo', ruolo, 'ufficio_id', ufficio_id) ORDER BY cognome), '[]')
                     FROM profiles WHERE ruolo = 'backoffice' AND attivo),
    'commerciali', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'cognome', cognome, 'ruolo', ruolo) ORDER BY cognome), '[]')
                      FROM profiles WHERE ruolo IN ('account_executive', 'executive', 'produttore_sede', 'responsabile_sede') AND attivo)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.lookup_intermediari() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_intermediari() TO authenticated;
