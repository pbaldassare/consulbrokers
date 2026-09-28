-- Fix post-backfill: promuove le quietanze orfane (niente polizza per numero+compagnia)
-- e tenta di eliminare i gusci residui sullo stesso periodo della nuova polizza.

-- 1) Catene senza polizza: la prima quietanza diventa polizza.
UPDATE public.titoli t
SET sostituisce_polizza = NULL, sostituisce_riga = NULL
FROM (
  SELECT DISTINCT ON (q.numero_titolo, q.compagnia_id) q.id AS first_id
  FROM public.titoli q
  WHERE q.sostituisce_polizza IS NOT NULL
    AND COALESCE(q.is_regolazione, false) = false
    AND COALESCE(q.is_proroga, false) = false
    AND COALESCE(q.is_appendice_modifica, false) = false
    AND q.numero_titolo IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.titoli m
      WHERE m.numero_titolo IS NOT DISTINCT FROM q.numero_titolo
        AND m.compagnia_id IS NOT DISTINCT FROM q.compagnia_id
        AND m.sostituisce_polizza IS NULL
        AND COALESCE(m.is_regolazione, false) = false
        AND COALESCE(m.is_proroga, false) = false
        AND COALESCE(m.is_appendice_modifica, false) = false
    )
  ORDER BY q.numero_titolo, q.compagnia_id, q.garanzia_da NULLS LAST, q.riga NULLS LAST, q.created_at NULLS LAST
) s
WHERE t.id = s.first_id
  AND t.sostituisce_polizza IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.titoli x
    WHERE x.id <> t.id
      AND x.numero_titolo IS NOT DISTINCT FROM t.numero_titolo
      AND x.compagnia_id IS NOT DISTINCT FROM t.compagnia_id
      AND x.data_scadenza IS NOT DISTINCT FROM t.data_scadenza
      AND x.sostituisce_polizza IS NULL
      AND x.numero_titolo IS NOT NULL
      AND x.data_scadenza IS NOT NULL
  );

-- 2) Gusci residui (stesso periodo della polizza già promossa): elimina se senza FK.
DO $del$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT shell.id
    FROM public.titoli shell
    JOIN public.titoli pol
      ON pol.numero_titolo = shell.numero_titolo
     AND pol.compagnia_id IS NOT DISTINCT FROM shell.compagnia_id
     AND pol.sostituisce_polizza IS NULL
     AND pol.id <> shell.id
     AND COALESCE(pol.is_regolazione, false) = false
     AND COALESCE(pol.is_proroga, false) = false
     AND COALESCE(pol.is_appendice_modifica, false) = false
    WHERE shell.sostituisce_polizza IS NOT DISTINCT FROM shell.numero_titolo
      AND COALESCE(shell.is_regolazione, false) = false
      AND COALESCE(shell.is_proroga, false) = false
      AND COALESCE(shell.is_appendice_modifica, false) = false
      AND shell.garanzia_da IS NOT DISTINCT FROM pol.garanzia_da
  LOOP
    BEGIN
      DELETE FROM public.quietanze WHERE titolo_id = r.id;
      DELETE FROM public.titoli WHERE id = r.id;
    EXCEPTION WHEN foreign_key_violation THEN
      NULL;
    END;
  END LOOP;
END;
$del$;
