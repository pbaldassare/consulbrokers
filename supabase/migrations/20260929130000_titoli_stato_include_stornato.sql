-- Ripristina lo stato 'stornato' nel check di titoli.
-- Era presente fino a marzo 2026; la migrazione di aprile lo ha perso
-- lasciando solo attivo/sospeso/scaduto/incassato/annullato/in_attesa_rinnovo.
-- Lo storno UI (StornoTitoloDialog) e le voci PS del gestionale usano 'stornato'.

ALTER TABLE public.titoli DROP CONSTRAINT IF EXISTS titoli_stato_check;
ALTER TABLE public.titoli ADD CONSTRAINT titoli_stato_check
  CHECK (stato IN ('attivo','sospeso','scaduto','incassato','annullato','in_attesa_rinnovo','stornato'));
