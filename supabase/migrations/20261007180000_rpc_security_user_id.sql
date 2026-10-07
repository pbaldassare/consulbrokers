-- Sicurezza RPC SECURITY DEFINER (07/10/2026).
-- 1) Chat: le funzioni accettavano _user_id di chiunque → anteprime e non letti di altri utenti.
--    Firma invariata (il frontend passa sempre il proprio id), ma ora rispondono solo se _user_id = utente collegato.
-- 2) Report: giravano come proprietario e ignoravano la RLS (tutte le sedi, anche per clienti del portale).
--    Ora SECURITY INVOKER: ognuno vede solo ciò che la RLS gli consente.
-- 3) admin_set_sede_profile: richiamabile da qualsiasi utente; serve solo all'edge provision-sedi-users (service_role).

CREATE OR REPLACE FUNCTION public.get_chat_unread_count(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(COUNT(m.id), 0)
  FROM public.chat_canali_membri cm
  JOIN public.chat_messaggi_interni m ON m.canale_id = cm.canale_id
  WHERE cm.user_id = _user_id
    AND _user_id = auth.uid()
    AND m.mittente_id <> _user_id
    AND m.created_at > COALESCE(cm.ultimo_letto_at, '1970-01-01'::timestamptz)
$function$;

CREATE OR REPLACE FUNCTION public.get_canali_staff_with_meta(_user_id uuid, _ambito text, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
RETURNS TABLE(id uuid, nome text, tipo text, entita_tipo text, entita_id text, ambito text, visibile_cliente boolean, created_at timestamp with time zone, last_message_at timestamp with time zone, last_message_preview text, unread_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH miei_canali AS (
    SELECT cm.canale_id, cm.ultimo_letto_at
    FROM public.chat_canali_membri cm
    WHERE cm.user_id = _user_id
      AND _user_id = auth.uid()
  ),
  msg_meta AS (
    SELECT DISTINCT ON (m.canale_id)
      m.canale_id,
      m.created_at AS last_message_at,
      m.messaggio AS last_message_preview
    FROM public.chat_messaggi_interni m
    WHERE m.canale_id IN (SELECT canale_id FROM miei_canali)
    ORDER BY m.canale_id, m.created_at DESC
  ),
  unread AS (
    SELECT m.canale_id, COUNT(*) AS unread_count
    FROM public.chat_messaggi_interni m
    JOIN miei_canali mc ON mc.canale_id = m.canale_id
    WHERE m.mittente_id <> _user_id
      AND m.created_at > COALESCE(mc.ultimo_letto_at, '1970-01-01'::timestamptz)
    GROUP BY m.canale_id
  )
  SELECT
    c.id, c.nome, c.tipo, c.entita_tipo, c.entita_id, c.ambito, c.visibile_cliente, c.created_at,
    mm.last_message_at, mm.last_message_preview,
    COALESCE(u.unread_count, 0) AS unread_count
  FROM public.chat_canali c
  JOIN miei_canali mc ON mc.canale_id = c.id
  LEFT JOIN msg_meta mm ON mm.canale_id = c.id
  LEFT JOIN unread u ON u.canale_id = c.id
  WHERE c.ambito = _ambito
  ORDER BY COALESCE(mm.last_message_at, c.created_at) DESC
  LIMIT _limit OFFSET _offset;
$function$;

CREATE OR REPLACE FUNCTION public.get_canali_cliente_with_meta(_user_id uuid, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
RETURNS TABLE(id uuid, nome text, entita_tipo text, entita_id text, ambito text, visibile_cliente boolean, created_at timestamp with time zone, last_message_at timestamp with time zone, last_message_preview text, unread_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH miei_canali AS (
    SELECT cm.canale_id, cm.ultimo_letto_at
    FROM public.chat_canali_membri cm
    WHERE cm.user_id = _user_id
      AND _user_id = auth.uid()
  ),
  msg_meta AS (
    SELECT DISTINCT ON (m.canale_id)
      m.canale_id,
      m.created_at AS last_message_at,
      m.messaggio AS last_message_preview
    FROM public.chat_messaggi_interni m
    WHERE m.canale_id IN (SELECT canale_id FROM miei_canali)
    ORDER BY m.canale_id, m.created_at DESC
  ),
  unread AS (
    SELECT m.canale_id, COUNT(*) AS unread_count
    FROM public.chat_messaggi_interni m
    JOIN miei_canali mc ON mc.canale_id = m.canale_id
    WHERE m.mittente_id <> _user_id
      AND m.created_at > COALESCE(mc.ultimo_letto_at, '1970-01-01'::timestamptz)
    GROUP BY m.canale_id
  )
  SELECT
    c.id, c.nome, c.entita_tipo, c.entita_id, c.ambito, c.visibile_cliente, c.created_at,
    mm.last_message_at, mm.last_message_preview,
    COALESCE(u.unread_count, 0) AS unread_count
  FROM public.chat_canali c
  JOIN miei_canali mc ON mc.canale_id = c.id
  LEFT JOIN msg_meta mm ON mm.canale_id = c.id
  LEFT JOIN unread u ON u.canale_id = c.id
  WHERE c.ambito = 'contestuale'
    AND c.visibile_cliente = true
  ORDER BY COALESCE(mm.last_message_at, c.created_at) DESC
  LIMIT _limit OFFSET _offset;
$function$;

ALTER FUNCTION public.report_banca_ko SECURITY INVOKER;
ALTER FUNCTION public.report_contabilita SECURITY INVOKER;
ALTER FUNCTION public.report_provvigioni_produttore SECURITY INVOKER;
ALTER FUNCTION public.report_sinistri SECURITY INVOKER;
ALTER FUNCTION public.report_titoli_incassati SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.admin_set_sede_profile(uuid, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_sede_profile(uuid, text, text, text, uuid, jsonb) TO service_role;
