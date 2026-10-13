-- Allinea RLS di movimenti_clienti / movimenti_polizze ai conti condivisi
-- (stesso criterio di movimenti_bancari.mb_sede_*).
-- Una sede che opera su un conto in conti_bancari_uffici deve poter
-- scrivere l'abbinamento anche se movimenti_bancari.ufficio_id è di
-- un'altra sede (titolare del conto). Senza questo, conferma_messa_cassa
-- va a buon fine e il collegamento bonifico fallisce con 42501.

DROP POLICY IF EXISTS "mc_sede_rw" ON public.movimenti_clienti;
CREATE POLICY "mc_sede_rw" ON public.movimenti_clienti
  FOR ALL TO authenticated
  USING (
    ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.movimenti_bancari mb
      WHERE mb.id = movimenti_clienti.movimento_id
        AND (
          mb.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.conti_bancari_uffici cbu
            WHERE cbu.conto_bancario_id = mb.conto_bancario_id
              AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
          )
        )
    )
  )
  WITH CHECK (
    ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.movimenti_bancari mb
      WHERE mb.id = movimenti_clienti.movimento_id
        AND (
          mb.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.conti_bancari_uffici cbu
            WHERE cbu.conto_bancario_id = mb.conto_bancario_id
              AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
          )
        )
    )
  );

DROP POLICY IF EXISTS "mp_sede_rw" ON public.movimenti_polizze;
CREATE POLICY "mp_sede_rw" ON public.movimenti_polizze
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.movimenti_clienti mc
      JOIN public.movimenti_bancari mb ON mb.id = mc.movimento_id
      WHERE mc.id = movimenti_polizze.movimento_cliente_id
        AND (
          mc.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
          OR mb.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.conti_bancari_uffici cbu
            WHERE cbu.conto_bancario_id = mb.conto_bancario_id
              AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.movimenti_clienti mc
      JOIN public.movimenti_bancari mb ON mb.id = mc.movimento_id
      WHERE mc.id = movimenti_polizze.movimento_cliente_id
        AND (
          mc.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
          OR mb.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.conti_bancari_uffici cbu
            WHERE cbu.conto_bancario_id = mb.conto_bancario_id
              AND cbu.ufficio_id = (SELECT ufficio_id FROM public.profiles WHERE id = auth.uid())
          )
        )
    )
  );
