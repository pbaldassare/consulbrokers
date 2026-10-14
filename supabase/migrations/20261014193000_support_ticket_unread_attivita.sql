-- Unread Ticket Supporto: ogni risposta dell'altra parte rialza badge/pallino.
-- 1) L'UPDATE del turno marca updated_at + aggiornato_da = autore evento
--    (non solo auth.uid(), che in trigger SECURITY DEFINER può essere null).
-- 2) Realtime su ticket ed eventi, così l'altra parte ricalcola senza attendere il poll.

CREATE OR REPLACE FUNCTION private.support_ticket_sync_turno()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stato text;
  v_autore uuid;
BEGIN
  SELECT stato INTO v_stato FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_autore := COALESCE(NEW.autore_id, (SELECT auth.uid()));

  IF NEW.tipo = 'risposta_utente' OR v_stato = 'risolto' THEN
    UPDATE public.support_tickets
      SET utente_puo_rispondere = false,
          aggiornato_da = v_autore
      WHERE id = NEW.ticket_id;
  ELSIF NEW.tipo IN ('nota_admin', 'cambio_stato') THEN
    UPDATE public.support_tickets
      SET utente_puo_rispondere = true,
          aggiornato_da = v_autore
      WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.support_ticket_prepare_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.numero IS DISTINCT FROM OLD.numero
     OR NEW.richiedente_id IS DISTINCT FROM OLD.richiedente_id
     OR NEW.richiedente_nome IS DISTINCT FROM OLD.richiedente_nome
     OR NEW.richiedente_email IS DISTINCT FROM OLD.richiedente_email
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.data_apertura IS DISTINCT FROM OLD.data_apertura THEN
    RAISE EXCEPTION 'I dati identificativi del ticket non sono modificabili';
  END IF;

  NEW.updated_at := now();
  NEW.aggiornato_da := COALESCE((SELECT auth.uid()), NEW.aggiornato_da, OLD.aggiornato_da);

  IF NEW.stato IS DISTINCT FROM OLD.stato THEN
    IF NEW.stato = 'preso_in_carico' AND NEW.data_presa_in_carico IS NULL THEN
      NEW.data_presa_in_carico := now();
    END IF;
    IF NEW.stato = 'risolto' AND NEW.data_risoluzione IS NULL THEN
      NEW.data_risoluzione := now();
    ELSIF NEW.stato <> 'risolto' THEN
      NEW.data_risoluzione := NULL;
    END IF;
  END IF;

  IF NEW.stato = 'risolto' THEN
    NEW.utente_puo_rispondere := false;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON TABLE public.support_ticket_letture IS
  'Ultima visita a Ticket Supporto per utente. Unread = attività (create/reply) dopo visto_il, escluso chi ha scritto per ultimo.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_ticket_eventi'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_eventi;
  END IF;
END;
$$;
