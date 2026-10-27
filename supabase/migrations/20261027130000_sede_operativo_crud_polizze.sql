-- Specialist / Resp. Sede: stesso CRUD polizze-clienti della sede di ufficio/contabilità.

-- Titoli e clienti: perimetro sede solo per ruoli operativi di sede (non via sede_scope "aperto").
ALTER POLICY sede_scope_titoli ON public.titoli
  USING (
    (SELECT public.is_global_viewer())
    OR (
      (SELECT public.is_sede_operativo())
      AND ufficio_id = ANY (public.get_my_ufficio_ids())
    )
  )
  WITH CHECK (
    (SELECT public.is_global_viewer())
    OR (
      (SELECT public.is_sede_operativo())
      AND ufficio_id = ANY (public.get_my_ufficio_ids())
    )
  );

ALTER POLICY sede_scope_clienti ON public.clienti
  USING (
    (SELECT public.is_global_viewer())
    OR (
      (SELECT public.is_sede_operativo())
      AND ufficio_id = ANY (public.get_my_ufficio_ids())
    )
  )
  WITH CHECK (
    (SELECT public.is_global_viewer())
    OR (
      (SELECT public.is_sede_operativo())
      AND ufficio_id = ANY (public.get_my_ufficio_ids())
    )
  );

ALTER POLICY sede_scope_sinistri ON public.sinistri
  USING (
    (SELECT public.is_global_viewer())
    OR (
      (SELECT public.is_sede_operativo())
      AND ufficio_id = ANY (public.get_my_ufficio_ids())
    )
  )
  WITH CHECK (
    (SELECT public.is_global_viewer())
    OR (
      (SELECT public.is_sede_operativo())
      AND ufficio_id = ANY (public.get_my_ufficio_ids())
    )
  );

ALTER POLICY sede_scope_movimenti_contabili ON public.movimenti_contabili
  USING (
    (SELECT public.is_global_viewer())
    OR (
      (SELECT public.is_sede_operativo())
      AND ufficio_id = ANY (public.get_my_ufficio_ids())
    )
  )
  WITH CHECK (
    (SELECT public.is_global_viewer())
    OR (
      (SELECT public.is_sede_operativo())
      AND ufficio_id = ANY (public.get_my_ufficio_ids())
    )
  );

-- Profili colleghi stessa sede (embed scheda polizza / split commerciali).
DROP POLICY IF EXISTS "Sede operativo select profiles same office" ON public.profiles;
CREATE POLICY "Sede operativo select profiles same office"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    (SELECT public.is_sede_operativo())
    AND ufficio_id = ANY (public.get_my_ufficio_ids())
  );

-- Split provvigioni su polizza (immissione + TitoloDetail).
DROP POLICY IF EXISTS "split_select_via_titolo" ON public.titoli_split_commerciali;
CREATE POLICY "split_select_via_titolo"
  ON public.titoli_split_commerciali FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (SELECT public.has_role(auth.uid(), 'cfo'::public.app_role))
    OR (SELECT public.has_role(auth.uid(), 'contabilita'::public.app_role))
    OR (
      (SELECT public.is_sede_operativo())
      AND EXISTS (
        SELECT 1 FROM public.titoli t
        WHERE t.id = titoli_split_commerciali.titolo_id
          AND (
            t.ufficio_id = ANY (public.get_my_ufficio_ids())
            OR cardinality(public.get_my_ufficio_ids()) = 0
          )
      )
    )
  );

DROP POLICY IF EXISTS "split_insert_via_titolo" ON public.titoli_split_commerciali;
CREATE POLICY "split_insert_via_titolo"
  ON public.titoli_split_commerciali FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (
      (SELECT public.is_sede_operativo())
      AND EXISTS (
        SELECT 1 FROM public.titoli t
        WHERE t.id = titoli_split_commerciali.titolo_id
          AND (
            t.ufficio_id = ANY (public.get_my_ufficio_ids())
            OR cardinality(public.get_my_ufficio_ids()) = 0
          )
      )
    )
  );

DROP POLICY IF EXISTS "split_update_via_titolo" ON public.titoli_split_commerciali;
CREATE POLICY "split_update_via_titolo"
  ON public.titoli_split_commerciali FOR UPDATE TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (
      (SELECT public.is_sede_operativo())
      AND EXISTS (
        SELECT 1 FROM public.titoli t
        WHERE t.id = titoli_split_commerciali.titolo_id
          AND (
            t.ufficio_id = ANY (public.get_my_ufficio_ids())
            OR cardinality(public.get_my_ufficio_ids()) = 0
          )
      )
    )
  )
  WITH CHECK (
    (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (
      (SELECT public.is_sede_operativo())
      AND EXISTS (
        SELECT 1 FROM public.titoli t
        WHERE t.id = titoli_split_commerciali.titolo_id
          AND (
            t.ufficio_id = ANY (public.get_my_ufficio_ids())
            OR cardinality(public.get_my_ufficio_ids()) = 0
          )
      )
    )
  );

DROP POLICY IF EXISTS "split_delete_via_titolo" ON public.titoli_split_commerciali;
CREATE POLICY "split_delete_via_titolo"
  ON public.titoli_split_commerciali FOR DELETE TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (
      (SELECT public.is_sede_operativo())
      AND EXISTS (
        SELECT 1 FROM public.titoli t
        WHERE t.id = titoli_split_commerciali.titolo_id
          AND (
            t.ufficio_id = ANY (public.get_my_ufficio_ids())
            OR cardinality(public.get_my_ufficio_ids()) = 0
          )
      )
    )
  );

-- Codici commerciali / default intermediari cliente (immissione).
DROP POLICY IF EXISTS "Admin/ufficio can manage codici_commerciali" ON public.codici_commerciali_cliente;
CREATE POLICY "Admin/ufficio can manage codici_commerciali"
  ON public.codici_commerciali_cliente FOR ALL TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (SELECT public.is_sede_operativo())
  )
  WITH CHECK (
    (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (SELECT public.is_sede_operativo())
  );

DROP POLICY IF EXISTS "Admin/ufficio can manage clienti_intermediari_default" ON public.clienti_intermediari_default;
CREATE POLICY "Admin/ufficio can manage clienti_intermediari_default"
  ON public.clienti_intermediari_default FOR ALL TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (SELECT public.is_sede_operativo())
  )
  WITH CHECK (
    (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
    OR (SELECT public.is_sede_operativo())
  );
