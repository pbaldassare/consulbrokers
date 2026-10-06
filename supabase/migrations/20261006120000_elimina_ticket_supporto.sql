-- Ticket Supporto: eliminazione riservata all'account admin@consul.it
-- (solo per ticket inutili, es. di prova). Eventi e allegati cadono in cascata.

CREATE OR REPLACE FUNCTION private.support_ticket_can_delete()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(btrim(u.email)) = 'admin@consul.it'
  )
  AND public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

REVOKE ALL ON FUNCTION private.support_ticket_can_delete() FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.support_ticket_can_delete() TO authenticated;

CREATE OR REPLACE FUNCTION public.elimina_support_ticket(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT private.support_ticket_can_delete() THEN
    RAISE EXCEPTION 'Solo admin@consul.it può eliminare i ticket';
  END IF;

  DELETE FROM public.support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket non trovato';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.elimina_support_ticket(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.elimina_support_ticket(uuid) TO authenticated;

DROP POLICY IF EXISTS ticket_supporto_storage_delete ON storage.objects;
CREATE POLICY ticket_supporto_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'ticket-supporto'
    AND private.support_ticket_can_delete()
  );
