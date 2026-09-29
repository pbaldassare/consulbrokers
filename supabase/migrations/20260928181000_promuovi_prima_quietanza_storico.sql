-- Storico rivoluzione polizza/quietanza:
-- 1) la polizza PUÒ avere data_copertura (drop vecchio blocco);
-- 2) prima quietanza → polizza; guscio madre diventa quietanza e si elimina se senza FK.

-- ---------------------------------------------------------------------------
-- A) Copertura sulla polizza (prima rata incassabile)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_titoli_no_copertura_madre ON public.titoli;
DROP TRIGGER IF EXISTS trg_clear_madre_copertura_after_quietanza ON public.titoli;

CREATE OR REPLACE FUNCTION public.enforce_no_copertura_polizza_madre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Legacy no-op: la polizza è la prima rata e può avere data_copertura.
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_data_copertura_polizza_madre(p_titolo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Legacy no-op: non azzerare la copertura della polizza.
  RETURN;
END;
$$;

-- ---------------------------------------------------------------------------
-- B) Mapping set-based: una prima quietanza per (numero_titolo, compagnia_id)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public._promo_polizza_tmp;

CREATE UNLOGGED TABLE public._promo_polizza_tmp AS
WITH firsts AS (
  SELECT DISTINCT ON (m.numero_titolo, m.compagnia_id)
    m.numero_titolo,
    m.compagnia_id,
    q.id AS first_id
  FROM public.titoli m
  JOIN public.titoli q
    ON q.sostituisce_polizza = m.numero_titolo
   AND q.id <> m.id
   AND q.compagnia_id IS NOT DISTINCT FROM m.compagnia_id
   AND COALESCE(q.is_regolazione, false) = false
   AND COALESCE(q.is_proroga, false) = false
   AND COALESCE(q.is_appendice_modifica, false) = false
  WHERE m.sostituisce_polizza IS NULL
    AND COALESCE(m.is_regolazione, false) = false
    AND COALESCE(m.is_proroga, false) = false
    AND COALESCE(m.is_appendice_modifica, false) = false
    AND m.numero_titolo IS NOT NULL
  ORDER BY m.numero_titolo, m.compagnia_id, q.garanzia_da NULLS LAST, q.riga NULLS LAST, q.created_at NULLS LAST
)
SELECT m.id AS madre_id, f.first_id, m.numero_titolo
FROM public.titoli m
JOIN firsts f
  ON f.numero_titolo = m.numero_titolo
 AND f.compagnia_id IS NOT DISTINCT FROM m.compagnia_id
WHERE m.sostituisce_polizza IS NULL
  AND COALESCE(m.is_regolazione, false) = false
  AND COALESCE(m.is_proroga, false) = false
  AND COALESCE(m.is_appendice_modifica, false) = false;

CREATE INDEX _promo_polizza_tmp_madre ON public._promo_polizza_tmp (madre_id);
CREATE INDEX _promo_polizza_tmp_first ON public._promo_polizza_tmp (first_id);

-- 1) I gusci smettono di essere polizza (libera l'indice unico).
UPDATE public.titoli t
SET sostituisce_polizza = t.numero_titolo
FROM public._promo_polizza_tmp p
WHERE t.id = p.madre_id
  AND t.sostituisce_polizza IS NULL;

-- 2) Promuovi la prima quietanza (salta se resta un conflitto unico).
UPDATE public.titoli t
SET sostituisce_polizza = NULL, sostituisce_riga = NULL
FROM (SELECT DISTINCT first_id FROM public._promo_polizza_tmp) f
WHERE t.id = f.first_id
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

-- 3) Ripunta i FK dal guscio alla polizza promossa.
UPDATE public.polizze x SET titolo_madre_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_madre_id = p.madre_id;
UPDATE public.titoli x SET appendice_modifica_polizza_madre_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.appendice_modifica_polizza_madre_id = p.madre_id;
UPDATE public.titoli x SET proroga_polizza_madre_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.proroga_polizza_madre_id = p.madre_id;
UPDATE public.titoli x SET regolazione_quietanza_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.regolazione_quietanza_id = p.madre_id;
UPDATE public.titoli x SET titolo_storno_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_storno_id = p.madre_id;
UPDATE public.sinistri x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.sinistro_reminder x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.movimenti_polizza x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.movimenti_polizze x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.cliente_anticipi x SET titolo_origine_id = p.first_id
FROM (
  SELECT DISTINCT ON (first_id) madre_id, first_id
  FROM public._promo_polizza_tmp
  ORDER BY first_id, madre_id
) p
WHERE x.titolo_origine_id = p.madre_id
  AND NOT EXISTS (SELECT 1 FROM public.cliente_anticipi y WHERE y.titolo_origine_id = p.first_id);
UPDATE public.cliente_anticipi_utilizzi x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.giroconti_cliente x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.dettaglio_riparto x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.provvigioni_generate x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.rimessa_dettaglio x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.note_restituzione_dettaglio x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.distinte_restituzione_originali_righe x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.elaborazioni x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.richieste_quietanza_righe x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.rca_preventivi x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.polizza_cga x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.conducenti_polizza x SET titolo_id = p.first_id
FROM (
  SELECT DISTINCT ON (first_id) madre_id, first_id
  FROM public._promo_polizza_tmp
  ORDER BY first_id, madre_id
) p
WHERE x.titolo_id = p.madre_id
  AND NOT EXISTS (SELECT 1 FROM public.conducenti_polizza y WHERE y.titolo_id = p.first_id);
DELETE FROM public.conducenti_polizza x USING public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;

UPDATE public.libro_matricola_mezzi x SET titolo_id = p.first_id
FROM public._promo_polizza_tmp p
WHERE x.titolo_id = p.madre_id
  AND NOT EXISTS (
    SELECT 1 FROM public.libro_matricola_mezzi y
    WHERE y.titolo_id = p.first_id
      AND y.n_progressivo IS NOT DISTINCT FROM x.n_progressivo
  );
UPDATE public.libro_matricola_operazioni x SET titolo_id = p.first_id
FROM public._promo_polizza_tmp p
WHERE x.titolo_id = p.madre_id
  AND NOT EXISTS (
    SELECT 1 FROM public.libro_matricola_operazioni y
    WHERE y.titolo_id = p.first_id
      AND y.n_operazione IS NOT DISTINCT FROM x.n_operazione
  );
UPDATE public.roma_exe_polizze_map x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.titoli_compensazioni x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.titoli_eventi_snapshot x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.titoli_modalita_incasso x SET titolo_id = p.first_id
FROM (
  SELECT DISTINCT ON (first_id) madre_id, first_id
  FROM public._promo_polizza_tmp
  ORDER BY first_id, madre_id
) p
WHERE x.titolo_id = p.madre_id
  AND NOT EXISTS (
    SELECT 1 FROM public.titoli_modalita_incasso y
    WHERE y.titolo_id = p.first_id AND y.stato = 'attiva' AND x.stato = 'attiva'
  );
DELETE FROM public.titoli_modalita_incasso x USING public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.titoli_numeri_storici x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.titoli_proroghe x SET titolo_madre_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_madre_id = p.madre_id;
UPDATE public.titoli_proroghe x SET titolo_proroga_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_proroga_id = p.madre_id;
UPDATE public.titoli_regolazione_fattori x SET titolo_id = p.first_id
FROM public._promo_polizza_tmp p
WHERE x.titolo_id = p.madre_id
  AND NOT EXISTS (
    SELECT 1 FROM public.titoli_regolazione_fattori y
    WHERE y.titolo_id = p.first_id
      AND y.fattore_id IS NOT DISTINCT FROM x.fattore_id
      AND y.anno IS NOT DISTINCT FROM x.anno
  );
UPDATE public.titoli_regolazioni x SET titolo_madre_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_madre_id = p.madre_id;
UPDATE public.titoli_regolazioni x SET titolo_regolazione_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_regolazione_id = p.madre_id;
UPDATE public.titoli_regolazioni x SET quietanza_riferimento_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.quietanza_riferimento_id = p.madre_id;
UPDATE public.titoli_sostituzioni x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.titoli_sostituzioni x SET titolo_conguaglio_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_conguaglio_id = p.madre_id;
UPDATE public.titoli_storni x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.titoli_storni x SET titolo_storno_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_storno_id = p.madre_id;
UPDATE public.appendici_polizza x SET titolo_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_id = p.madre_id;
UPDATE public.appendici_polizza x SET quietanza_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.quietanza_id = p.madre_id;
UPDATE public.appendici_polizza x SET titolo_modifica_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_modifica_id = p.madre_id;
UPDATE public.appendici_polizza x SET titolo_proroga_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_proroga_id = p.madre_id;
UPDATE public.appendici_polizza x SET titolo_regolazione_id = p.first_id FROM public._promo_polizza_tmp p WHERE x.titolo_regolazione_id = p.madre_id;

UPDATE public.veicoli_polizza v SET titolo_id = p.first_id
FROM (
  SELECT DISTINCT ON (first_id) madre_id, first_id
  FROM public._promo_polizza_tmp
  ORDER BY first_id, madre_id
) p
WHERE v.titolo_id = p.madre_id
  AND NOT EXISTS (SELECT 1 FROM public.veicoli_polizza x WHERE x.titolo_id = p.first_id);
DELETE FROM public.veicoli_polizza v USING public._promo_polizza_tmp p WHERE v.titolo_id = p.madre_id;

UPDATE public.premi_garanzia_polizza g SET titolo_id = p.first_id
FROM (
  SELECT DISTINCT ON (first_id) madre_id, first_id
  FROM public._promo_polizza_tmp
  ORDER BY first_id, madre_id
) p
WHERE g.titolo_id = p.madre_id
  AND NOT EXISTS (SELECT 1 FROM public.premi_garanzia_polizza x WHERE x.titolo_id = p.first_id);
DELETE FROM public.premi_garanzia_polizza g USING public._promo_polizza_tmp p WHERE g.titolo_id = p.madre_id;

UPDATE public.titoli_split_commerciali s SET titolo_id = p.first_id
FROM (
  SELECT DISTINCT ON (first_id) madre_id, first_id
  FROM public._promo_polizza_tmp
  ORDER BY first_id, madre_id
) p
WHERE s.titolo_id = p.madre_id
  AND NOT EXISTS (
    SELECT 1 FROM public.titoli_split_commerciali x
    WHERE x.titolo_id = p.first_id
      AND x.anagrafica_commerciale_id IS NOT DISTINCT FROM s.anagrafica_commerciale_id
  );
DELETE FROM public.titoli_split_commerciali s USING public._promo_polizza_tmp p WHERE s.titolo_id = p.madre_id;

DELETE FROM public.quietanze q USING public._promo_polizza_tmp p WHERE q.titolo_id = p.madre_id;

-- 4) Elimina i gusci; se un FK resiste, restano quietanze (già staccati al passo 1).
DO $del$
DECLARE
  r record;
BEGIN
  BEGIN
    DELETE FROM public.titoli t
    USING public._promo_polizza_tmp p
    WHERE t.id = p.madre_id;
  EXCEPTION WHEN foreign_key_violation THEN
    FOR r IN SELECT DISTINCT madre_id FROM public._promo_polizza_tmp LOOP
      BEGIN
        DELETE FROM public.titoli WHERE id = r.madre_id;
      EXCEPTION WHEN foreign_key_violation THEN
        NULL;
      END;
    END LOOP;
  END;
END;
$del$;

DROP TABLE IF EXISTS public._promo_polizza_tmp;
