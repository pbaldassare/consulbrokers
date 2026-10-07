-- Funzioni interne (cron, edge con service_role, helper richiamati da altre SECURITY DEFINER): non chiamabili da browser.
-- Il cron gira come postgres (proprietario), le edge con service_role: non sono toccati.
REVOKE EXECUTE ON FUNCTION public.claim_messa_cassa_notifiche_coda() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_messa_cassa_notifiche_coda() TO service_role;
REVOKE EXECUTE ON FUNCTION public.invoke_bandi_cron_mattina() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_flush_messa_cassa_serale() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bandi_marca_scaduti_e_archivia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.garanzie_chat_assert_owner_consultazione(text, uuid) FROM PUBLIC, anon, authenticated;
-- Usate solo da pagine con login (hanno già il controllo sull'utente): niente accesso anonimo.
REVOKE EXECUTE ON FUNCTION public.prossimo_riferimento_ec(text, uuid, text, date, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rettifica_provvigioni_quietanza(uuid, numeric, text, date, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cerca_ec_agenzia_storico(uuid, date, date, text, text, text, text, integer, integer) FROM PUBLIC, anon;
