-- Tipologia ticket: richiesta implementazione vs bug.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS tipologia_problema text NOT NULL DEFAULT 'richiesta_implementazione'
  CHECK (tipologia_problema IN ('richiesta_implementazione', 'bug'));

COMMENT ON COLUMN public.support_tickets.tipologia_problema IS
  'richiesta_implementazione = evolutiva; bug = malfunzionamento.';

CREATE INDEX IF NOT EXISTS idx_support_tickets_tipologia_stato
  ON public.support_tickets (tipologia_problema, stato, updated_at DESC);
