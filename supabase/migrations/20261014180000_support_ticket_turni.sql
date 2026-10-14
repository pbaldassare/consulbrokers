-- Conversazione a turni sui Ticket Supporto:
-- dopo il salvataggio del supporto l'utente può rispondere/allegare;
-- dopo la risposta utente si blocca; se risolto resta chiuso (solo admin riapre).

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS utente_puo_rispondere boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.support_tickets.utente_puo_rispondere IS
  'True solo dopo un salvataggio del supporto, finché l''utente non risponde o il ticket è risolto.';

ALTER TABLE public.support_ticket_eventi DROP CONSTRAINT IF EXISTS support_ticket_eventi_tipo_check;
ALTER TABLE public.support_ticket_eventi
  ADD CONSTRAINT support_ticket_eventi_tipo_check
  CHECK (tipo IN ('apertura', 'cambio_stato', 'nota_admin', 'risposta_utente'));

CREATE OR REPLACE FUNCTION private.support_ticket_sync_turno()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stato text;
BEGIN
  SELECT stato INTO v_stato FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo = 'risposta_utente' OR v_stato = 'risolto' THEN
    UPDATE public.support_tickets
      SET utente_puo_rispondere = false
      WHERE id = NEW.ticket_id;
  ELSIF NEW.tipo IN ('nota_admin', 'cambio_stato') THEN
    UPDATE public.support_tickets
      SET utente_puo_rispondere = true
      WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_ticket_sync_turno ON public.support_ticket_eventi;
CREATE TRIGGER support_ticket_sync_turno
  AFTER INSERT ON public.support_ticket_eventi
  FOR EACH ROW EXECUTE FUNCTION private.support_ticket_sync_turno();

REVOKE ALL ON FUNCTION private.support_ticket_sync_turno() FROM PUBLIC;

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
  NEW.aggiornato_da := auth.uid();

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

DROP POLICY IF EXISTS support_ticket_eventi_insert_utente ON public.support_ticket_eventi;
CREATE POLICY support_ticket_eventi_insert_utente
  ON public.support_ticket_eventi
  FOR INSERT TO authenticated
  WITH CHECK (
    tipo = 'risposta_utente'
    AND autore_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.richiedente_id = auth.uid()
        AND t.stato <> 'risolto'
        AND t.utente_puo_rispondere
    )
  );

DROP POLICY IF EXISTS support_ticket_allegati_insert ON public.support_ticket_allegati;
CREATE POLICY support_ticket_allegati_insert
  ON public.support_ticket_allegati
  FOR INSERT TO authenticated
  WITH CHECK (
    caricato_da = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR (
            t.richiedente_id = auth.uid()
            AND t.stato <> 'risolto'
            AND (
              t.utente_puo_rispondere
              OR (
                t.created_at > now() - interval '5 minutes'
                AND NOT EXISTS (
                  SELECT 1 FROM public.support_ticket_eventi e
                  WHERE e.ticket_id = t.id
                    AND e.tipo IN ('nota_admin', 'cambio_stato', 'risposta_utente')
                )
              )
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS ticket_supporto_storage_insert ON storage.objects;
CREATE POLICY ticket_supporto_storage_insert
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-supporto'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR (
            t.richiedente_id = auth.uid()
            AND t.stato <> 'risolto'
            AND (
              t.utente_puo_rispondere
              OR (
                t.created_at > now() - interval '5 minutes'
                AND NOT EXISTS (
                  SELECT 1 FROM public.support_ticket_eventi e
                  WHERE e.ticket_id = t.id
                    AND e.tipo IN ('nota_admin', 'cambio_stato', 'risposta_utente')
                )
              )
            )
          )
        )
    )
  );

-- Ticket già toccati dal supporto e ancora aperti: l'utente può riprendere.
UPDATE public.support_tickets t
SET utente_puo_rispondere = true
WHERE t.stato <> 'risolto'
  AND EXISTS (
    SELECT 1 FROM public.support_ticket_eventi e
    WHERE e.ticket_id = t.id
      AND e.tipo IN ('nota_admin', 'cambio_stato')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.support_ticket_eventi u
    WHERE u.ticket_id = t.id
      AND u.tipo = 'risposta_utente'
      AND u.created_at >= COALESCE((
        SELECT max(e.created_at)
        FROM public.support_ticket_eventi e
        WHERE e.ticket_id = t.id
          AND e.tipo IN ('nota_admin', 'cambio_stato')
      ), '-infinity'::timestamptz)
  );
