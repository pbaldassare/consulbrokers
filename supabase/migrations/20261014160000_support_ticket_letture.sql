-- Letture Ticket Supporto sul profilo (non localStorage):
-- badge e pallini restano a zero dopo F5, hard reload e cambio browser.
-- Solo ticket creati dopo visto_il tornano non letti.

CREATE TABLE IF NOT EXISTS public.support_ticket_letture (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  visto_il timestamptz,
  aperti_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.support_ticket_letture IS
  'Ultima visita a Ticket Supporto per utente. Fonte di verità badge/non letti.';

ALTER TABLE public.support_ticket_letture ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.support_ticket_letture TO authenticated;

DROP POLICY IF EXISTS "Own support ticket letture select" ON public.support_ticket_letture;
DROP POLICY IF EXISTS "Own support ticket letture insert" ON public.support_ticket_letture;
DROP POLICY IF EXISTS "Own support ticket letture update" ON public.support_ticket_letture;

CREATE POLICY "Own support ticket letture select"
  ON public.support_ticket_letture
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Own support ticket letture insert"
  ON public.support_ticket_letture
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own support ticket letture update"
  ON public.support_ticket_letture
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
