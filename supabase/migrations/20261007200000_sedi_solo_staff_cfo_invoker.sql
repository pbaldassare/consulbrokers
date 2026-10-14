-- 1) get_my_ufficio_ids: clienti e prospect del portale non hanno "sedi".
--    Prima un cliente con ufficio_id sul profilo passava le 103 policy "propria sede" (47 tabelle)
--    e poteva leggere/modificare/cancellare i dati di tutta la sede via API.
--    Chi ha anche un ruolo interno in user_roles resta com'era.
CREATE OR REPLACE FUNCTION public.get_my_ufficio_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid() AND role NOT IN ('cliente', 'prospect')
    ) THEN '{}'::uuid[]
    ELSE COALESCE(
      NULLIF(ARRAY(SELECT ufficio_id FROM public.profilo_sedi WHERE profilo_id = auth.uid()), '{}'::uuid[]),
      (SELECT ARRAY[ufficio_id] FROM public.profiles WHERE id = auth.uid() AND ufficio_id IS NOT NULL),
      '{}'::uuid[]
    )
  END
$function$;

-- 2) Portale cliente: legge solo la sede delle proprie anagrafiche cliente (pagina "Info e Contatti").
DROP POLICY IF EXISTS "Cliente select sede propria" ON public.uffici;
CREATE POLICY "Cliente select sede propria" ON public.uffici
  FOR SELECT TO authenticated
  USING (id IN (SELECT c.ufficio_id FROM public.clienti c WHERE c.id IN (SELECT public.get_my_cliente_ids())));

-- 3) Cruscotto direzione: con i permessi di chi chiama (admin/CFO vedono tutto, gli altri il proprio perimetro).
--    Verificato: per admin e CFO risultati identici a prima.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'cfo\_%' AND p.prosecdef LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', f);
  END LOOP;
END $$;

-- 4) Personale interno = ha almeno un ruolo di sistema diverso da cliente/prospect.
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

-- 5) Tabelle con dati aperte a qualsiasi utente collegato (clienti del portale compresi):
--    restano al personale interno come prima, non più a clienti e prospect.
--    I clienti mantengono le loro policy dedicate (es. "Cliente select own sinistri").
ALTER POLICY "Authenticated full access sinistri" ON public.sinistri
  USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));
ALTER POLICY "Authenticated full access sinistro_reminder" ON public.sinistro_reminder
  USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));
ALTER POLICY "Authenticated full access ec_agenzia_archivio" ON public.ec_agenzia_archivio
  USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));
ALTER POLICY "Staff manage distinte_restituzione_originali" ON public.distinte_restituzione_originali
  USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));
ALTER POLICY "Staff manage distinte_restituzione_originali_righe" ON public.distinte_restituzione_originali_righe
  USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));
ALTER POLICY "Staff manage libro_matricola_operazioni" ON public.libro_matricola_operazioni
  USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));
ALTER POLICY "Staff manage richieste_quietanza" ON public.richieste_quietanza
  USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));
ALTER POLICY "Staff manage richieste_quietanza_righe" ON public.richieste_quietanza_righe
  USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));
ALTER POLICY "Staff select titoli_proroghe" ON public.titoli_proroghe USING ((SELECT public.is_staff()));
ALTER POLICY "Staff insert titoli_proroghe" ON public.titoli_proroghe WITH CHECK ((SELECT public.is_staff()));
ALTER POLICY "Eventi snapshot leggibili agli autenticati" ON public.titoli_eventi_snapshot USING ((SELECT public.is_staff()));
ALTER POLICY "Eventi snapshot insertabili agli autenticati" ON public.titoli_eventi_snapshot WITH CHECK ((SELECT public.is_staff()));
ALTER POLICY "Auth select polizze terzi" ON public.polizze_terzi USING ((SELECT public.is_staff()));
ALTER POLICY "Authenticated can read clienti_intermediari_default" ON public.clienti_intermediari_default USING ((SELECT public.is_staff()));
ALTER POLICY "roma_exe_clienti_map_select" ON public.roma_exe_clienti_map USING ((SELECT public.is_staff()));
ALTER POLICY "roma_exe_compagnie_map_select" ON public.roma_exe_compagnie_map USING ((SELECT public.is_staff()));
ALTER POLICY "roma_exe_polizze_map_select" ON public.roma_exe_polizze_map USING ((SELECT public.is_staff()));
ALTER POLICY "roma_exe_rischi_map_select" ON public.roma_exe_rischi_map USING ((SELECT public.is_staff()));
ALTER POLICY "roma_uno_clienti_map_select" ON public.roma_uno_clienti_map USING ((SELECT public.is_staff()));
-- Parco veicoli: il cliente vede i mezzi delle polizze che già vede (RLS di titoli).
ALTER POLICY "lmm_select_auth" ON public.libro_matricola_mezzi
  USING ((SELECT public.is_staff()) OR EXISTS (SELECT 1 FROM public.titoli t WHERE t.id = libro_matricola_mezzi.titolo_id));
