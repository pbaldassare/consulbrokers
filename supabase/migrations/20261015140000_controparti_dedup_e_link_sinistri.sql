-- Deduplica controparti (nome/cognome invertiti) + FK su sinistri.

CREATE OR REPLACE FUNCTION public.controparte_denominazione_norm_key(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT nullif(
    lower(
      array_to_string(
        (
          SELECT array_agg(w ORDER BY w)
          FROM unnest(
            regexp_split_to_array(lower(trim(both FROM coalesce(p, ''))), '\s+')
          ) AS w
          WHERE w <> ''
        ),
        ' '
      )
    ),
    ''
  );
$$;

ALTER TABLE public.controparti_sinistri
  ADD COLUMN IF NOT EXISTS denominazione_norm text;

UPDATE public.controparti_sinistri
SET denominazione_norm = public.controparte_denominazione_norm_key(denominazione)
WHERE denominazione_norm IS DISTINCT FROM public.controparte_denominazione_norm_key(denominazione);

-- Unisce doppioni: resta la riga col codice minore, unisce i recapiti.
DO $$
DECLARE
  r record;
  v_keep_id uuid;
  v_loser_id uuid;
  i int;
BEGIN
  FOR r IN
    SELECT denominazione_norm, array_agg(id ORDER BY codice ASC) AS ids
    FROM public.controparti_sinistri
    WHERE denominazione_norm IS NOT NULL
    GROUP BY denominazione_norm
    HAVING count(*) > 1
  LOOP
    v_keep_id := r.ids[1];
    FOR i IN 2..array_length(r.ids, 1) LOOP
      v_loser_id := r.ids[i];
      UPDATE public.controparti_sinistri AS k
      SET
        email = coalesce(k.email, d.email),
        pec = coalesce(k.pec, d.pec),
        telefono = coalesce(k.telefono, d.telefono),
        cellulare = coalesce(k.cellulare, d.cellulare),
        note = CASE
          WHEN k.note IS NULL OR trim(k.note) = '' THEN d.note
          WHEN d.note IS NULL OR trim(d.note) = '' THEN k.note
          ELSE k.note || E'\n' || d.note
        END,
        denominazione = CASE
          WHEN length(trim(d.denominazione)) > length(trim(k.denominazione)) THEN d.denominazione
          ELSE k.denominazione
        END,
        updated_at = now()
      FROM public.controparti_sinistri AS d
      WHERE k.id = v_keep_id AND d.id = v_loser_id;

      DELETE FROM public.controparti_sinistri WHERE id = v_loser_id;
    END LOOP;

    UPDATE public.controparti_sinistri
    SET denominazione_norm = public.controparte_denominazione_norm_key(denominazione)
    WHERE id = v_keep_id;
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.controparti_sinistri_denominazione_norm_idx;

CREATE UNIQUE INDEX controparti_sinistri_denominazione_norm_key_idx
  ON public.controparti_sinistri (denominazione_norm)
  WHERE denominazione_norm IS NOT NULL;

CREATE OR REPLACE FUNCTION public.trg_controparti_sinistri_set_norm()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.denominazione := trim(both FROM NEW.denominazione);
  NEW.denominazione_norm := public.controparte_denominazione_norm_key(NEW.denominazione);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_controparti_sinistri_set_norm ON public.controparti_sinistri;
CREATE TRIGGER trg_controparti_sinistri_set_norm
  BEFORE INSERT OR UPDATE OF denominazione ON public.controparti_sinistri
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_controparti_sinistri_set_norm();

ALTER TABLE public.sinistri
  ADD COLUMN IF NOT EXISTS controparte_sinistri_id uuid
  REFERENCES public.controparti_sinistri (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sinistri_controparte_sinistri_id_idx
  ON public.sinistri (controparte_sinistri_id);

UPDATE public.sinistri s
SET controparte_sinistri_id = c.id
FROM public.controparti_sinistri c
WHERE s.controparte_sinistri_id IS NULL
  AND s.controparte IS NOT NULL
  AND trim(s.controparte) <> ''
  AND c.denominazione_norm = public.controparte_denominazione_norm_key(s.controparte);

COMMENT ON COLUMN public.sinistri.controparte_sinistri_id IS
  'FK anagrafica controparte; controparte resta denormalizzato per ricerche legacy.';
