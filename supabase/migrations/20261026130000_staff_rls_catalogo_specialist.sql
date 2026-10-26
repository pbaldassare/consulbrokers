-- Specialist (backoffice) e Resp. Sede: stesso perimetro operativo sede + lettura cataloghi immissione.

CREATE OR REPLACE FUNCTION public.is_sede_operativo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'ufficio'::public.app_role,
        'backoffice'::public.app_role,
        'contabilita'::public.app_role,
        'responsabile_sede'::public.app_role
      )
  )
$$;

REVOKE ALL ON FUNCTION public.is_sede_operativo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_sede_operativo() TO authenticated;

-- Cataloghi tabelle base (immissione, provvigioni, estrazioni)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rami',
    'gruppi_ramo',
    'prodotti',
    'matrice_provvigioni',
    'categorie_prodotto',
    'gruppi_statistici',
    'tipi_rinnovo',
    'tipi_mandatario'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Staff select %I" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "Staff select %I" ON public.%I FOR SELECT TO authenticated USING ((SELECT public.is_staff()))',
      t, t
    );
  END LOOP;
END $$;

-- Commerciali / produttori in sede (immissione polizza)
DROP POLICY IF EXISTS "Sede operativo select anagrafiche_prof" ON public.anagrafiche_professionali;
CREATE POLICY "Sede operativo select anagrafiche_prof"
  ON public.anagrafiche_professionali FOR SELECT TO authenticated
  USING (
    (SELECT public.is_sede_operativo())
    AND (
      ufficio_id = ANY (public.get_my_ufficio_ids())
      OR ufficio_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Sede operativo update anagrafiche_prof" ON public.anagrafiche_professionali;
CREATE POLICY "Sede operativo update anagrafiche_prof"
  ON public.anagrafiche_professionali FOR UPDATE TO authenticated
  USING (
    (SELECT public.is_sede_operativo())
    AND ufficio_id = ANY (public.get_my_ufficio_ids())
  )
  WITH CHECK (
    (SELECT public.is_sede_operativo())
    AND ufficio_id = ANY (public.get_my_ufficio_ids())
  );

DROP POLICY IF EXISTS "Sede operativo insert anagrafiche_prof" ON public.anagrafiche_professionali;
CREATE POLICY "Sede operativo insert anagrafiche_prof"
  ON public.anagrafiche_professionali FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_sede_operativo())
    AND (
      ufficio_id = ANY (public.get_my_ufficio_ids())
      OR ufficio_id IS NULL
    )
  );

DROP POLICY IF EXISTS "Sede operativo select ppr" ON public.produttori_provvigioni_ramo;
CREATE POLICY "Sede operativo select ppr"
  ON public.produttori_provvigioni_ramo FOR SELECT TO authenticated
  USING (
    (SELECT public.is_sede_operativo())
    AND EXISTS (
      SELECT 1
      FROM public.anagrafiche_professionali ap
      WHERE ap.id = produttori_provvigioni_ramo.anagrafica_id
        AND (
          ap.ufficio_id = ANY (public.get_my_ufficio_ids())
          OR ap.ufficio_id IS NULL
        )
    )
  );

-- Contabilità sede: stesso read di ufficio/contabilità
DROP POLICY IF EXISTS "Sede operativo read chiusure_contabili" ON public.chiusure_contabili;
CREATE POLICY "Sede operativo read chiusure_contabili"
  ON public.chiusure_contabili FOR SELECT TO authenticated
  USING ((SELECT public.is_sede_operativo()));

DROP POLICY IF EXISTS "Sede operativo read distinte_giornaliere" ON public.distinte_giornaliere;
CREATE POLICY "Sede operativo read distinte_giornaliere"
  ON public.distinte_giornaliere FOR SELECT TO authenticated
  USING ((SELECT public.is_sede_operativo()));

DROP POLICY IF EXISTS "Sede operativo read distinte_giornaliere_righe" ON public.distinte_giornaliere_righe;
CREATE POLICY "Sede operativo read distinte_giornaliere_righe"
  ON public.distinte_giornaliere_righe FOR SELECT TO authenticated
  USING ((SELECT public.is_sede_operativo()));
