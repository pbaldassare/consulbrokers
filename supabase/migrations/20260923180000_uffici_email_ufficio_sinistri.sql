-- Email dedicata dell'ufficio sinistri per ogni sede.
-- Non sostituisce uffici.email (mail istituzionale della sede).

ALTER TABLE public.uffici
  ADD COLUMN IF NOT EXISTS email_ufficio_sinistri text;

COMMENT ON COLUMN public.uffici.email_ufficio_sinistri IS
  'Email dell''ufficio sinistri della sede. NULL se non impostata. Non sostituisce email sede.';
