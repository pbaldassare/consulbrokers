-- Ticket esistenti (pre-classificazione) erano tutti segnalazioni di malfunzionamento.

UPDATE public.support_tickets
SET tipologia_problema = 'bug'
WHERE tipologia_problema IS DISTINCT FROM 'bug';
