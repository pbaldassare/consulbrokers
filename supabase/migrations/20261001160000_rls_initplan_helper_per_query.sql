-- RLS: le funzioni di identità/permesso nelle policy di public vengono valutate una volta per query
-- (InitPlan) invece che per riga, avvolgendole in (SELECT ...). Semantica invariata.
-- Con la forma non avvolta ogni ricerca ILIKE valutava has_role/get_my_ufficio_ids/... su ogni riga
-- (es. ricerca clienti come utente di sede: 3,1 s su 12.5k righe).
--
-- Avvolte solo le chiamate che non dipendono dalla riga:
--   auth.uid(), has_role(auth.uid(), '<ruolo>'), get_my_ufficio_ids(), get_my_ufficio_id(),
--   is_global_viewer(), is_documentale_staff().
-- Non toccate: get_my_cliente_ids() (già in subquery), is_channel_member(auth.uid(), canale_id).
-- Le chiamate già avvolte (precedute da "SELECT ") restano come sono.
--
-- Nuove policy: scrivere direttamente (SELECT auth.uid()), (SELECT has_role(auth.uid(), 'x')), ecc.
-- Rieseguire questa migration è innocuo: riconosce le forme già avvolte.

CREATE OR REPLACE FUNCTION public._rls_wrap_initplan(p_expr text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          p_expr,
          '(?<!SELECT )(?<![.\w])auth\.uid\(\)', '(SELECT auth.uid())', 'g'),
        '(?<!SELECT )(?<![.\w])has_role\(\(SELECT auth\.uid\(\)\), (''[a-z_]+''::app_role)\)',
        '(SELECT has_role(auth.uid(), \1))', 'g'),
      -- il cast tiene "= ANY (...)" nella forma array: "= ANY ((SELECT ...))" sarebbe una subquery
      '(?<!SELECT )(?<![.\w])get_my_ufficio_ids\(\)', '((SELECT get_my_ufficio_ids())::uuid[])', 'g'),
    '(?<!SELECT )(?<![.\w])(get_my_ufficio_id|is_global_viewer|is_documentale_staff)\(\)',
    '(SELECT \1())', 'g')
$$;

DO $$
DECLARE
  p record;
  v_qual text;
  v_check text;
  v_sql text;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    v_qual := CASE WHEN p.qual IS NULL THEN NULL ELSE public._rls_wrap_initplan(p.qual) END;
    v_check := CASE WHEN p.with_check IS NULL THEN NULL ELSE public._rls_wrap_initplan(p.with_check) END;

    IF v_qual IS NOT DISTINCT FROM p.qual AND v_check IS NOT DISTINCT FROM p.with_check THEN
      CONTINUE;
    END IF;

    v_sql := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
    IF v_qual IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_qual);
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_check);
    END IF;
    EXECUTE v_sql;
  END LOOP;
END;
$$;

DROP FUNCTION public._rls_wrap_initplan(text);
