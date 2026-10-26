-- Specialist (backoffice) e resto del personale interno devono leggere gruppi_compagnia
-- (immissione polizza: tendina "Compagnia Assicurativa"). Prima: solo admin/ufficio/cfo.

DROP POLICY IF EXISTS "Admin all gruppi_compagnia" ON public.gruppi_compagnia;
DROP POLICY IF EXISTS "Ufficio select gruppi_compagnia" ON public.gruppi_compagnia;
DROP POLICY IF EXISTS "CFO select gruppi_compagnia" ON public.gruppi_compagnia;

CREATE POLICY "Staff select gruppi_compagnia"
  ON public.gruppi_compagnia FOR SELECT TO authenticated
  USING ((SELECT public.is_staff()));

CREATE POLICY "Admin manage gruppi_compagnia"
  ON public.gruppi_compagnia FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'::public.app_role)))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin'::public.app_role)));
