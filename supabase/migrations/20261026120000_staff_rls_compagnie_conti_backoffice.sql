-- Specialist (backoffice) e resp. sede: lettura agenzie/conti/movimenti sede come ufficio/contabilità.

-- Agenzie (tabella compagnie) in immissione polizza
DROP POLICY IF EXISTS "Admin all compagnie" ON public.compagnie;
DROP POLICY IF EXISTS "CFO select compagnie" ON public.compagnie;
DROP POLICY IF EXISTS "Ufficio select compagnie" ON public.compagnie;
DROP POLICY IF EXISTS "Cliente select compagnie" ON public.compagnie;
DROP POLICY IF EXISTS "Authenticated full access compagnie" ON public.compagnie;
DROP POLICY IF EXISTS "Staff select compagnie" ON public.compagnie;
DROP POLICY IF EXISTS "Admin manage compagnie" ON public.compagnie;

CREATE POLICY "Staff select compagnie"
  ON public.compagnie FOR SELECT TO authenticated
  USING (
    (SELECT public.is_staff())
    OR (SELECT public.has_role(auth.uid(), 'cliente'::public.app_role))
  );

CREATE POLICY "Admin manage compagnie"
  ON public.compagnie FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin'::public.app_role)));

-- Conti Consulbrokers (messa a cassa bonifico)
DROP POLICY IF EXISTS "Staff read conti_bancari" ON public.conti_bancari;
CREATE POLICY "Staff read conti_bancari"
  ON public.conti_bancari FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "Staff read conti_bancari_uffici" ON public.conti_bancari_uffici;
CREATE POLICY "Staff read conti_bancari_uffici"
  ON public.conti_bancari_uffici FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

-- Movimenti bancari: perimetro sede (profilo_sedi + ufficio_id)
DROP POLICY IF EXISTS "mb_sede_select" ON public.movimenti_bancari;
CREATE POLICY "mb_sede_select" ON public.movimenti_bancari
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (SELECT public.has_role(auth.uid(), 'cfo'::public.app_role))
    OR movimenti_bancari.ufficio_id = ANY (public.get_my_ufficio_ids())
    OR EXISTS (
      SELECT 1 FROM public.conti_bancari_uffici cbu
      WHERE cbu.conto_bancario_id = movimenti_bancari.conto_bancario_id
        AND cbu.ufficio_id = ANY (public.get_my_ufficio_ids())
    )
  );

DROP POLICY IF EXISTS "mb_sede_update" ON public.movimenti_bancari;
CREATE POLICY "mb_sede_update" ON public.movimenti_bancari
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (SELECT public.has_role(auth.uid(), 'cfo'::public.app_role))
    OR movimenti_bancari.ufficio_id = ANY (public.get_my_ufficio_ids())
    OR EXISTS (
      SELECT 1 FROM public.conti_bancari_uffici cbu
      WHERE cbu.conto_bancario_id = movimenti_bancari.conto_bancario_id
        AND cbu.ufficio_id = ANY (public.get_my_ufficio_ids())
    )
  )
  WITH CHECK (
    (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (SELECT public.has_role(auth.uid(), 'cfo'::public.app_role))
    OR movimenti_bancari.ufficio_id = ANY (public.get_my_ufficio_ids())
    OR EXISTS (
      SELECT 1 FROM public.conti_bancari_uffici cbu
      WHERE cbu.conto_bancario_id = movimenti_bancari.conto_bancario_id
        AND cbu.ufficio_id = ANY (public.get_my_ufficio_ids())
    )
  );

DROP POLICY IF EXISTS "mb_sede_insert" ON public.movimenti_bancari;
CREATE POLICY "mb_sede_insert" ON public.movimenti_bancari
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (SELECT public.has_role(auth.uid(), 'cfo'::public.app_role))
    OR movimenti_bancari.ufficio_id = ANY (public.get_my_ufficio_ids())
    OR EXISTS (
      SELECT 1 FROM public.conti_bancari_uffici cbu
      WHERE cbu.conto_bancario_id = movimenti_bancari.conto_bancario_id
        AND cbu.ufficio_id = ANY (public.get_my_ufficio_ids())
    )
  );
