-- Area Ticket Supporto: richieste degli utenti verso IT/amministratori.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  richiedente_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  richiedente_nome text NOT NULL,
  richiedente_email text NOT NULL,
  ufficio_id uuid REFERENCES public.uffici(id) ON DELETE SET NULL,
  titolo text NOT NULL CHECK (char_length(btrim(titolo)) BETWEEN 5 AND 160),
  descrizione text NOT NULL CHECK (char_length(btrim(descrizione)) BETWEEN 20 AND 10000),
  cliente_riferimento text,
  polizza_riferimento text,
  stato text NOT NULL DEFAULT 'aperto'
    CHECK (stato IN ('aperto', 'preso_in_carico', 'risolto')),
  data_apertura timestamptz NOT NULL DEFAULT now(),
  data_presa_in_carico timestamptz,
  data_risoluzione timestamptz,
  aggiornato_da uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.support_ticket_eventi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('apertura', 'cambio_stato', 'nota_admin')),
  stato_da text CHECK (stato_da IS NULL OR stato_da IN ('aperto', 'preso_in_carico', 'risolto')),
  stato_a text CHECK (stato_a IS NULL OR stato_a IN ('aperto', 'preso_in_carico', 'risolto')),
  nota text CHECK (nota IS NULL OR char_length(btrim(nota)) <= 5000),
  autore_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  autore_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.support_ticket_allegati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  nome_file text NOT NULL,
  path_storage text NOT NULL UNIQUE,
  bucket_name text NOT NULL DEFAULT 'ticket-supporto'
    CHECK (bucket_name = 'ticket-supporto'),
  mime_type text,
  dimensione_bytes bigint CHECK (dimensione_bytes IS NULL OR dimensione_bytes >= 0),
  caricato_da uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_richiedente
  ON public.support_tickets (richiedente_id, created_at DESC);
CREATE INDEX idx_support_tickets_stato
  ON public.support_tickets (stato, updated_at DESC);
CREATE INDEX idx_support_ticket_eventi_ticket
  ON public.support_ticket_eventi (ticket_id, created_at);
CREATE INDEX idx_support_ticket_allegati_ticket
  ON public.support_ticket_allegati (ticket_id, created_at);

COMMENT ON TABLE public.support_tickets IS
  'Ticket aperti dagli utenti verso il supporto IT; solo gli admin possono cambiarne lo stato.';
COMMENT ON TABLE public.support_ticket_eventi IS
  'Timeline immutabile di apertura, cambi stato e note amministrative dei ticket.';

CREATE OR REPLACE FUNCTION private.support_ticket_prepare_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NEW.richiedente_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Richiedente non valido';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND OR v_profile.attivo IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Profilo non valido o non attivo';
  END IF;

  NEW.richiedente_nome := btrim(concat_ws(' ', v_profile.nome, v_profile.cognome));
  IF NEW.richiedente_nome = '' THEN
    NEW.richiedente_nome := coalesce(v_profile.email, 'Utente CBnet');
  END IF;
  NEW.richiedente_email := coalesce(
    nullif(btrim(v_profile.email), ''),
    nullif(btrim(auth.jwt() ->> 'email'), '')
  );
  IF NEW.richiedente_email IS NULL THEN
    RAISE EXCEPTION 'Email del richiedente non disponibile';
  END IF;
  NEW.ufficio_id := v_profile.ufficio_id;
  NEW.stato := 'aperto';
  NEW.data_apertura := now();
  NEW.data_presa_in_carico := NULL;
  NEW.data_risoluzione := NULL;
  NEW.aggiornato_da := auth.uid();
  NEW.created_at := now();
  NEW.updated_at := now();
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
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.support_ticket_log_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.support_ticket_eventi
      (ticket_id, tipo, stato_a, nota, autore_id, autore_nome)
    VALUES
      (NEW.id, 'apertura', 'aperto', 'Ticket aperto', NEW.richiedente_id, NEW.richiedente_nome);
  ELSIF NEW.stato IS DISTINCT FROM OLD.stato THEN
    INSERT INTO public.support_ticket_eventi
      (ticket_id, tipo, stato_da, stato_a, autore_id, autore_nome)
    SELECT
      NEW.id, 'cambio_stato', OLD.stato, NEW.stato, auth.uid(),
      coalesce(nullif(btrim(concat_ws(' ', p.nome, p.cognome)), ''), p.email, 'Amministratore')
    FROM public.profiles p
    WHERE p.id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER support_ticket_prepare_insert
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION private.support_ticket_prepare_insert();
CREATE TRIGGER support_ticket_prepare_update
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION private.support_ticket_prepare_update();
CREATE TRIGGER support_ticket_log_insert
  AFTER INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION private.support_ticket_log_event();
CREATE TRIGGER support_ticket_log_update
  AFTER UPDATE OF stato ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION private.support_ticket_log_event();

REVOKE ALL ON FUNCTION private.support_ticket_prepare_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.support_ticket_prepare_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.support_ticket_log_event() FROM PUBLIC;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_eventi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_allegati ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT UPDATE ON public.support_tickets TO authenticated;
GRANT SELECT, INSERT ON public.support_ticket_eventi TO authenticated;
GRANT SELECT, INSERT ON public.support_ticket_allegati TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.support_tickets_numero_seq TO authenticated;
GRANT ALL ON public.support_tickets, public.support_ticket_eventi,
  public.support_ticket_allegati TO service_role;

CREATE POLICY support_tickets_select
  ON public.support_tickets FOR SELECT TO authenticated
  USING (
    richiedente_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY support_tickets_insert
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (
    richiedente_id = auth.uid()
    AND stato = 'aperto'
  );

CREATE POLICY support_tickets_update_admin
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY support_ticket_eventi_select
  ON public.support_ticket_eventi FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (
          t.richiedente_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

CREATE POLICY support_ticket_eventi_insert_admin
  ON public.support_ticket_eventi FOR INSERT TO authenticated
  WITH CHECK (
    tipo = 'nota_admin'
    AND autore_id = auth.uid()
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY support_ticket_allegati_select
  ON public.support_ticket_allegati FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (
          t.richiedente_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

CREATE POLICY support_ticket_allegati_insert
  ON public.support_ticket_allegati FOR INSERT TO authenticated
  WITH CHECK (
    caricato_da = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND (
          t.richiedente_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('ticket-supporto', 'ticket-supporto', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = EXCLUDED.file_size_limit;

CREATE POLICY ticket_supporto_storage_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-supporto'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (
          t.richiedente_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

CREATE POLICY ticket_supporto_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-supporto'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (
          t.richiedente_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );
