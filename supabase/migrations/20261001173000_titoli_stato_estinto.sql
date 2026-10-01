-- Estinzione: titoli.stato = 'estinto' (chiusura anticipata, distinta da annullato).
-- Il check di settembre 2026 aveva perso questo valore: il pulsante UI falliva al save.

ALTER TABLE public.titoli DROP CONSTRAINT IF EXISTS titoli_stato_check;
ALTER TABLE public.titoli ADD CONSTRAINT titoli_stato_check
  CHECK (stato IN (
    'attivo','sospeso','scaduto','incassato','annullato',
    'in_attesa_rinnovo','stornato','estinto'
  ));

-- Contratto polizze: estinta (enum). ADD VALUE è transazionale su PG 15.
ALTER TYPE public.polizza_stato ADD VALUE IF NOT EXISTS 'estinta';
