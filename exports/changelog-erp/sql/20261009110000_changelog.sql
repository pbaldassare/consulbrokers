-- Changelog per i colleghi: popup al primo accesso dopo una pubblicazione, mostrato una sola volta per utente.
-- I testi li inserisce l'admin (per ora a mano, poi da una pagina di CBnet): bozza finché pubblicato_at è null.
CREATE TABLE IF NOT EXISTS public.changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creato_at timestamptz NOT NULL DEFAULT now(),
  pubblicato_at timestamptz,
  cambiamenti text[] NOT NULL DEFAULT '{}',
  bug_in_carico text[] NOT NULL DEFAULT '{}',
  problemi_noti text[] NOT NULL DEFAULT '{}'
);

-- Chi ha già chiuso quale changelog (vale su ogni dispositivo/browser)
CREATE TABLE IF NOT EXISTS public.changelog_letture (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  changelog_id uuid NOT NULL REFERENCES public.changelog(id) ON DELETE CASCADE,
  letto_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, changelog_id)
);

ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog_letture ENABLE ROW LEVEL SECURITY;

-- Personale interno: solo pubblicati; admin vede anche le bozze (anteprima) e gestisce
CREATE POLICY "Staff legge changelog pubblicati" ON public.changelog FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()) AND (pubblicato_at IS NOT NULL OR (SELECT public.has_role(auth.uid(), 'admin'::app_role))));
CREATE POLICY "Admin gestisce changelog" ON public.changelog FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Utente legge le proprie letture" ON public.changelog_letture FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Utente registra le proprie letture" ON public.changelog_letture FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Gestione changelog solo admin@consul.it (la pagina Pubblicazioni Changelog è sua)
ALTER POLICY "Admin gestisce changelog" ON public.changelog
  USING ((SELECT public.is_root_admin(auth.uid())))
  WITH CHECK ((SELECT public.is_root_admin(auth.uid())));
