-- Chat staff: "segna da leggere" e contatori non letti per scheda (Interna / Contestuale).
-- Usano auth.uid(): ognuno agisce solo sul proprio stato di lettura.

-- Riporta il segnalibro di lettura subito prima dell'ultimo messaggio ricevuto: la chat torna "da leggere".
CREATE OR REPLACE FUNCTION public.mark_canale_as_unread(_canale_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_last timestamptz;
BEGIN
  SELECT max(created_at) INTO v_last
    FROM chat_messaggi_interni
   WHERE canale_id = _canale_id AND mittente_id <> auth.uid();
  IF v_last IS NULL THEN
    RETURN false; -- nessun messaggio ricevuto: niente da segnare
  END IF;
  UPDATE chat_canali_membri
     SET ultimo_letto_at = v_last - interval '1 millisecond'
   WHERE canale_id = _canale_id AND user_id = auth.uid();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_chat_unread_per_ambito()
RETURNS TABLE(ambito text, unread bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.ambito, count(m.id)
    FROM chat_canali_membri cm
    JOIN chat_canali c ON c.id = cm.canale_id
    JOIN chat_messaggi_interni m ON m.canale_id = cm.canale_id
   WHERE cm.user_id = auth.uid()
     AND m.mittente_id <> auth.uid()
     AND m.created_at > coalesce(cm.ultimo_letto_at, '1970-01-01'::timestamptz)
   GROUP BY c.ambito;
$$;

REVOKE ALL ON FUNCTION public.mark_canale_as_unread(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_chat_unread_per_ambito() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_canale_as_unread(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_unread_per_ambito() TO authenticated;
