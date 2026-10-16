-- Sotto-stato interno admin per ticket "preso in carico": attesa risposta utente vs in lavorazione.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS preso_in_carico_fase text
  CHECK (
    preso_in_carico_fase IS NULL
    OR preso_in_carico_fase IN ('in_attesa_risposta', 'in_elaborazione')
  );

COMMENT ON COLUMN public.support_tickets.preso_in_carico_fase IS
  'Solo se stato = preso_in_carico: in_attesa_risposta = in attesa del richiedente; in_elaborazione = team al lavoro. Uso interno admin.';

CREATE INDEX IF NOT EXISTS idx_support_tickets_preso_in_carico_fase
  ON public.support_tickets (stato, preso_in_carico_fase, updated_at DESC)
  WHERE stato = 'preso_in_carico';

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

  IF NEW.stato IS DISTINCT FROM 'preso_in_carico' THEN
    NEW.preso_in_carico_fase := NULL;
  END IF;

  IF NEW.stato = 'risolto' THEN
    NEW.utente_puo_rispondere := false;
  END IF;
  RETURN NEW;
END;
$$;
