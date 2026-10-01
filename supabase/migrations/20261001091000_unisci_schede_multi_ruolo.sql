-- Unisce le schede della stessa persona registrate con ruoli diversi
-- (produttore / AE / responsabile di sede). Scheda principale: quella da
-- produttore (corrispondente), poi AE, poi responsabile di sede; a parità
-- quella attiva, più usata e più vecchia. I doppioni restano archiviati.

DO $$
DECLARE
  r record;
  v_n int := 0;
BEGIN
  FOR r IN
    WITH n AS (
      SELECT a.id, a.tipo, a.attivo, a.created_at,
             upper(regexp_replace(btrim(COALESCE(NULLIF(btrim(COALESCE(a.cognome, '') || ' ' || COALESCE(a.nome, '')), ''), a.ragione_sociale, '')), '\s+', ' ', 'g')) AS k,
             (SELECT count(*) FROM public.titoli t WHERE t.anagrafica_commerciale_id = a.id OR t.ae_anagrafica_id = a.id) AS refs
        FROM public.anagrafiche_professionali a
       WHERE a.tipo IN ('account_executive', 'corrispondente', 'responsabile_sede')
    ), g AS (
      SELECT k FROM n WHERE k <> '' GROUP BY k HAVING count(DISTINCT tipo) > 1
    ), ord AS (
      SELECT n.*, row_number() OVER (
               PARTITION BY n.k
               ORDER BY CASE n.tipo WHEN 'corrispondente' THEN 1 WHEN 'account_executive' THEN 2 ELSE 3 END,
                        n.attivo DESC NULLS LAST, n.refs DESC, n.created_at
             ) AS rn
        FROM n JOIN g USING (k)
    )
    SELECT m.id AS master, d.id AS dup
      FROM ord m JOIN ord d ON d.k = m.k AND d.rn > 1
     WHERE m.rn = 1
     ORDER BY m.k, d.rn
  LOOP
    PERFORM public.unisci_anagrafiche_professionali(r.master, r.dup);
    v_n := v_n + 1;
  END LOOP;
  RAISE NOTICE 'Schede unite: %', v_n;
END $$;

-- Polizze incassate dove ora AE e produttore sono la stessa scheda:
-- rigenera le provvigioni non pagate (vince il produttore).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT t.id
      FROM public.titoli t
      JOIN public.provvigioni_generate pg
        ON pg.titolo_id = t.id AND pg.tipo_destinatario = 'ae' AND COALESCE(pg.pagata, false) = false
     WHERE t.stato = 'incassato'
       AND t.ae_anagrafica_id IS NOT NULL
       AND (t.ae_anagrafica_id = t.anagrafica_commerciale_id
            OR EXISTS (SELECT 1 FROM public.titoli_split_commerciali s
                        WHERE s.titolo_id = t.id AND s.anagrafica_commerciale_id = t.ae_anagrafica_id))
  LOOP
    PERFORM public.fn_rigenera_provvigioni_generate(r.id);
  END LOOP;
END $$;
