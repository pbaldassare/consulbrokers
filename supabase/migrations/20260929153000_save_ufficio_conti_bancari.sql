-- Sincronizza i conti di una sede (N:N) senza toccare le altre sedi dello stesso conto.

CREATE OR REPLACE FUNCTION public.save_ufficio_conti_bancari(
  p_ufficio_id uuid,
  p_conto_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_unique uuid[];
  v_conto record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.uffici WHERE id = p_ufficio_id) THEN
    RAISE EXCEPTION 'Sede non trovata';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::uuid[]) INTO v_unique
  FROM unnest(COALESCE(p_conto_ids, ARRAY[]::uuid[])) AS x;

  FOR v_conto IN
    SELECT cb.id, cb.etichetta, cb.tipo
    FROM public.conti_bancari_uffici cbu
    JOIN public.conti_bancari cb ON cb.id = cbu.conto_bancario_id
    WHERE cbu.ufficio_id = p_ufficio_id
      AND NOT (cbu.conto_bancario_id = ANY (v_unique))
      AND cb.tipo = 'incasso_clienti'
      AND NOT EXISTS (
        SELECT 1
        FROM public.conti_bancari_uffici other
        WHERE other.conto_bancario_id = cbu.conto_bancario_id
          AND other.ufficio_id <> p_ufficio_id
      )
  LOOP
    RAISE EXCEPTION 'Il conto "%" è collegato solo a questa sede: abilitalo su un''altra sede dalla pagina Conti bancari prima di toglierlo.',
      COALESCE(v_conto.etichetta, v_conto.id::text);
  END LOOP;

  DELETE FROM public.conti_bancari_uffici cbu
  USING public.conti_bancari cb
  WHERE cbu.conto_bancario_id = cb.id
    AND cbu.ufficio_id = p_ufficio_id
    AND cb.tipo = 'incasso_clienti'
    AND NOT (cbu.conto_bancario_id = ANY (v_unique));

  INSERT INTO public.conti_bancari_uffici (conto_bancario_id, ufficio_id)
  SELECT c, p_ufficio_id
  FROM unnest(v_unique) AS c
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.conti_bancari_uffici cbu
    WHERE cbu.conto_bancario_id = c
      AND cbu.ufficio_id = p_ufficio_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_ufficio_conti_bancari(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_ufficio_conti_bancari(uuid, uuid[]) TO authenticated;
