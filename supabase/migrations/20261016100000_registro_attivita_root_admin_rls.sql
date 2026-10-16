-- Registro attività globale: lettura completa solo admin@consul.it (is_root_admin).
-- Timeline e log per entità restano accessibili via policy per entità visibile.

DROP POLICY IF EXISTS "Admin select all logs" ON public.log_attivita;

CREATE POLICY "Root admin select all logs" ON public.log_attivita
  FOR SELECT TO authenticated
  USING (public.is_root_admin(auth.uid()));

CREATE POLICY "Select logs for visible entity" ON public.log_attivita
  FOR SELECT TO authenticated
  USING (
    entita_id IS NOT NULL
    AND (
      (entita_tipo = 'titolo' AND EXISTS (SELECT 1 FROM public.titoli t WHERE t.id = log_attivita.entita_id))
      OR (entita_tipo = 'cliente' AND EXISTS (SELECT 1 FROM public.clienti c WHERE c.id = log_attivita.entita_id))
      OR (entita_tipo = 'sinistro' AND EXISTS (SELECT 1 FROM public.sinistri s WHERE s.id = log_attivita.entita_id))
      OR (entita_tipo = 'prospect' AND EXISTS (SELECT 1 FROM public.prospect p WHERE p.id = log_attivita.entita_id))
      OR (entita_tipo = 'trattativa' AND EXISTS (SELECT 1 FROM public.trattative tr WHERE tr.id = log_attivita.entita_id))
      OR (entita_tipo = 'compagnia' AND EXISTS (SELECT 1 FROM public.compagnie co WHERE co.id = log_attivita.entita_id))
      OR (
        entita_tipo = 'nota_restituzione'
        AND EXISTS (SELECT 1 FROM public.note_restituzione nr WHERE nr.id = log_attivita.entita_id)
      )
    )
  );

COMMENT ON POLICY "Root admin select all logs" ON public.log_attivita IS
  'Registro attività CBnet: elenco globale riservato ad admin@consul.it';
