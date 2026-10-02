-- Import Potenza del 29/09/2026:
-- le polizze di Egidio Comodo senza riparti multipli sono state caricate al
-- 100%, mentre la sua quota produttore configurata è 40%.
--
-- Correggiamo la percentuale memorizzata sul titolo (fonte usata sia dalla
-- Messa a Cassa sia da calcola-provvigioni). I titoli con split espliciti non
-- vengono toccati.
UPDATE public.titoli AS t
SET
  percentuale_commerciale = 40,
  updated_at = now()
WHERE COALESCE(t.anagrafica_commerciale_id, t.produttore_id)
        = '1e61cdf2-cd64-463e-8310-32d40306b6a8'::uuid
  AND t.ufficio_id = 'e4f0d1f5-e344-4920-b178-d8754904a108'::uuid
  AND t.created_at::date = DATE '2026-09-29'
  AND t.percentuale_commerciale = 100
  AND NOT EXISTS (
    SELECT 1
    FROM public.titoli_split_commerciali AS s
    WHERE s.titolo_id = t.id
  );
