-- Tendine Sede / Produttore / Account Executive / Specialist (Immissione polizza, scheda polizza, nuovo cliente):
-- devono mostrare TUTTE le sedi e TUTTE le persone a qualsiasi utente interno, di qualsiasi sede.
-- La RLS delle tabelle (uffici, anagrafiche_professionali, profiles) limita giustamente alla propria sede;
-- invece di allargarla (contengono IBAN, percentuali, dati personali) espongo solo i campi da tendina.

-- Personale interno = almeno un ruolo di sistema diverso da cliente/prospect.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid() AND role NOT IN ('cliente', 'prospect')
  )
$function$;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

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
    'specialist', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'cognome', cognome, 'ruolo', ruolo) ORDER BY cognome), '[]')
                     FROM profiles WHERE ruolo = 'backoffice' AND attivo),
    'commerciali', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'cognome', cognome, 'ruolo', ruolo) ORDER BY cognome), '[]')
                      FROM profiles WHERE ruolo IN ('account_executive', 'executive', 'produttore_sede', 'responsabile_sede') AND attivo)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.lookup_intermediari() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_intermediari() TO authenticated;
