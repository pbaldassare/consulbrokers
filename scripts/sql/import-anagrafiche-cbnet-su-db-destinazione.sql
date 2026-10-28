-- =============================================================================
-- Import anagrafiche: Consulbrokers (vecchio) → cbnet (nuovo)
-- =============================================================================
-- ESEGUI SU: progetto Supabase **cbnet** (ref ehvmsdvjqvjulcrmzwzm, region eu-west-2)
-- LEGGE DA: **Consulbrokers** (ref zbjmnnlojxprlogbnxef, region eu-west-1)
--
-- Host sorgente: db.zbjmnnlojxprlogbnxef.supabase.co:5432 · db postgres · user postgres
-- Password: Dashboard **Consulbrokers** → Settings → Database → Database password
--           (NON la password del progetto cbnet, NON le API key)
--
-- Differenze schema rilevate (MCP, ott 2026):
--   • public.uffici: sul cbnet manca email_ufficio_sinistri (17 col sorgente, 16 dest) — ok, non si copia
--   • auth.users: confirmed_at = colonna GENERATED sul dest → esclusa automaticamente
--   • auth.identities: email = colonna GENERATED sul dest → esclusa automaticamente
--   • Sedi seed cbnet (stesso codice_ufficio, UUID diversi): sync_uffici + id_remap
--
-- Blocchi 1→9; se timeout, un blocco per volta. Dopo BLOCCO 1 test:
--   SELECT count(*) FROM cbnet_import.clienti;
-- =============================================================================

-- ─── BLOCCO 1 — FDW verso Consulbrokers ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

DROP SCHEMA IF EXISTS cbnet_import CASCADE;
CREATE SCHEMA cbnet_import;

CREATE SERVER consulbrokers_src
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (
    host    'db.zbjmnnlojxprlogbnxef.supabase.co',
    dbname  'postgres',
    port    '5432',
    sslmode 'require'
  );

-- Pooler Session sorgente (eu-west-1) se il direct fallisce:
-- DROP SERVER consulbrokers_src CASCADE;
-- CREATE SERVER consulbrokers_src FOREIGN DATA WRAPPER postgres_fdw OPTIONS (
--   host 'aws-0-eu-west-1.pooler.supabase.com', dbname 'postgres', port '5432', sslmode 'require'
-- );

DROP USER MAPPING IF EXISTS FOR postgres SERVER consulbrokers_src;
CREATE USER MAPPING FOR postgres
  SERVER consulbrokers_src
  OPTIONS (
    user     'postgres',
    -- pooler: user 'postgres.zbjmnnlojxprlogbnxef',
    password '<<<PASSWORD_CONSULBROKERS>>>'
  );

IMPORT FOREIGN SCHEMA public
  LIMIT TO (
    uffici, gruppi_compagnia, gruppi_finanziari,
    compagnie, compagnia_rapporti, compagnia_rapporto_rami,
    anagrafiche_professionali, produttori_provvigioni_ramo,
    clienti, nominativi_cliente, codici_commerciali_cliente,
    clienti_intermediari_default, controparti_sinistri,
    profiles, user_roles, profilo_sedi
  )
  FROM SERVER consulbrokers_src INTO cbnet_import;

IMPORT FOREIGN SCHEMA auth
  LIMIT TO (users, identities)
  FROM SERVER consulbrokers_src INTO cbnet_import;

CREATE TABLE cbnet_import.id_remap (
  map_key text NOT NULL,
  src_id uuid NOT NULL,
  dst_id uuid NOT NULL,
  PRIMARY KEY (map_key, src_id)
);

-- Colonna inseribile sul destino: esiste su sorgente FDW, esiste su dest, non GENERATED sul dest.
CREATE OR REPLACE FUNCTION cbnet_import.dest_copyable(
  p_dest_schema text,
  p_dest_table text,
  p_column text,
  p_src_table text DEFAULT NULL
) RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns s
    WHERE s.table_schema = 'cbnet_import'
      AND s.table_name = COALESCE(p_src_table, p_dest_table)
      AND s.column_name = p_column
  )
  AND EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = p_dest_schema
      AND c.relname = p_dest_table
      AND a.attname = p_column
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND COALESCE(a.attgenerated, '') = ''
  );
$$;

CREATE OR REPLACE FUNCTION cbnet_import._col_select_expr(
  p_table text,
  p_column text,
  p_remap_keys text[]
) RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_column = ANY (p_remap_keys) THEN format(
      'COALESCE((SELECT r.dst_id FROM cbnet_import.id_remap r WHERE r.map_key = %L AND r.src_id = s.%I), s.%I)',
      p_column, p_column, p_column
    )
    ELSE format('s.%I', p_column)
  END;
$$;

CREATE OR REPLACE FUNCTION cbnet_import._agg_copyable_cols(
  p_dest_schema text,
  p_dest_table text,
  p_src_table text,
  p_prefix text DEFAULT '',
  p_exclude_id boolean DEFAULT false
) RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT string_agg(
    CASE WHEN p_prefix = '' THEN format('%I', c.column_name)
         ELSE format('%s.%I', p_prefix, c.column_name)
    END,
    ', ' ORDER BY c.ordinal_position
  )
  FROM information_schema.columns c
  WHERE c.table_schema = p_dest_schema
    AND c.table_name = p_dest_table
    AND (NOT p_exclude_id OR c.column_name <> 'id')
    AND cbnet_import.dest_copyable(p_dest_schema, p_dest_table, c.column_name, p_src_table);
$$;

CREATE OR REPLACE FUNCTION cbnet_import.sync_uffici() RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  v_dst_id uuid;
  v_set text;
  v_ins_cols text;
  v_ins_vals text;
  n bigint := 0;
BEGIN
  DELETE FROM cbnet_import.id_remap WHERE map_key = 'ufficio_id';

  FOR r IN SELECT * FROM cbnet_import.uffici LOOP
    v_dst_id := NULL;
    IF r.codice_ufficio IS NOT NULL AND btrim(r.codice_ufficio) <> '' THEN
      SELECT u.id INTO v_dst_id FROM public.uffici u
      WHERE u.codice_ufficio = r.codice_ufficio LIMIT 1;
    END IF;

    IF v_dst_id IS NOT NULL THEN
      SELECT string_agg(format('%I = v.%I', c.column_name, c.column_name), ', ')
      INTO v_set
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'uffici'
        AND c.column_name <> 'id'
        AND cbnet_import.dest_copyable('public', 'uffici', c.column_name, 'uffici');

      EXECUTE format(
        'UPDATE public.uffici t SET %s FROM cbnet_import.uffici v WHERE t.id = $1 AND v.id = $2',
        v_set
      ) USING v_dst_id, r.id;

      INSERT INTO cbnet_import.id_remap VALUES ('ufficio_id', r.id, v_dst_id)
      ON CONFLICT (map_key, src_id) DO UPDATE SET dst_id = EXCLUDED.dst_id;
    ELSE
      v_ins_cols := cbnet_import._agg_copyable_cols('public', 'uffici', 'uffici', '', false);
      SELECT string_agg(format('v.%I', c.column_name), ', ' ORDER BY c.ordinal_position)
      INTO v_ins_vals
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = 'uffici'
        AND cbnet_import.dest_copyable('public', 'uffici', c.column_name, 'uffici');

      EXECUTE format(
        'INSERT INTO public.uffici (%s) SELECT %s FROM cbnet_import.uffici v WHERE v.id = $1 ON CONFLICT (id) DO NOTHING',
        v_ins_cols, v_ins_vals
      ) USING r.id;

      INSERT INTO cbnet_import.id_remap VALUES ('ufficio_id', r.id, r.id)
      ON CONFLICT (map_key, src_id) DO UPDATE SET dst_id = EXCLUDED.dst_id;
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION cbnet_import.sync_by_codice(
  p_table text,
  p_map_key text
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  v_dst_id uuid;
  v_ins_cols text;
  v_ins_vals text;
  v_set text;
  n bigint := 0;
BEGIN
  DELETE FROM cbnet_import.id_remap WHERE map_key = p_map_key;

  FOR r IN EXECUTE format('SELECT * FROM cbnet_import.%I', p_table) LOOP
    v_dst_id := NULL;
    IF r.codice IS NOT NULL AND btrim(r.codice::text) <> '' THEN
      EXECUTE format('SELECT id FROM public.%I WHERE codice = $1 LIMIT 1', p_table)
        INTO v_dst_id USING r.codice;
    END IF;

    IF v_dst_id IS NOT NULL THEN
      SELECT string_agg(format('%I = v.%I', c.column_name, c.column_name), ', ')
      INTO v_set
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = p_table
        AND c.column_name <> 'id'
        AND cbnet_import.dest_copyable('public', p_table, c.column_name, p_table);

      EXECUTE format(
        'UPDATE public.%I t SET %s FROM cbnet_import.%I v WHERE t.id = $1 AND v.id = $2',
        p_table, v_set, p_table
      ) USING v_dst_id, r.id;

      INSERT INTO cbnet_import.id_remap VALUES (p_map_key, r.id, v_dst_id)
      ON CONFLICT (map_key, src_id) DO UPDATE SET dst_id = EXCLUDED.dst_id;
    ELSE
      v_ins_cols := cbnet_import._agg_copyable_cols('public', p_table, p_table, '', false);
      SELECT string_agg(format('v.%I', c.column_name), ', ' ORDER BY c.ordinal_position)
      INTO v_ins_vals
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = p_table
        AND cbnet_import.dest_copyable('public', p_table, c.column_name, p_table);

      EXECUTE format(
        'INSERT INTO public.%I (%s) SELECT %s FROM cbnet_import.%I v WHERE v.id = $1 ON CONFLICT (id) DO NOTHING',
        p_table, v_ins_cols, v_ins_vals, p_table
      ) USING r.id;

      INSERT INTO cbnet_import.id_remap VALUES (p_map_key, r.id, r.id)
      ON CONFLICT (map_key, src_id) DO UPDATE SET dst_id = EXCLUDED.dst_id;
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION cbnet_import.copy_table(
  p_dest_schema text,
  p_dest_table text,
  p_on_conflict text,
  p_do_nothing boolean DEFAULT false,
  p_remap_keys text[] DEFAULT ARRAY[]::text[],
  p_src_table text DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  src_t text := COALESCE(p_src_table, p_dest_table);
  src_cols text;
  sel_cols text;
  upd_clause text;
  conflict_cols text[];
  q text;
  n bigint;
BEGIN
  SELECT string_agg(format('%I', c.column_name), ', ' ORDER BY c.ordinal_position)
  INTO src_cols
  FROM information_schema.columns c
  WHERE c.table_schema = p_dest_schema
    AND c.table_name = p_dest_table
    AND cbnet_import.dest_copyable(p_dest_schema, p_dest_table, c.column_name, src_t);

  SELECT string_agg(
    cbnet_import._col_select_expr(src_t, c.column_name, p_remap_keys)
      || format(' AS %I', c.column_name),
    ', ' ORDER BY c.ordinal_position
  )
  INTO sel_cols
  FROM information_schema.columns c
  WHERE c.table_schema = p_dest_schema
    AND c.table_name = p_dest_table
    AND cbnet_import.dest_copyable(p_dest_schema, p_dest_table, c.column_name, src_t);

  IF src_cols IS NULL OR src_cols = '' THEN
    RAISE EXCEPTION 'copy_table: nessuna colonna copiabile per %.% (sorgente cbnet_import.%)',
      p_dest_schema, p_dest_table, src_t;
  END IF;

  conflict_cols := string_to_array(replace(p_on_conflict, ' ', ''), ',');

  IF p_do_nothing THEN
    q := format(
      'INSERT INTO %I.%I (%s) SELECT %s FROM cbnet_import.%I s ON CONFLICT (%s) DO NOTHING',
      p_dest_schema, p_dest_table, src_cols, sel_cols, src_t, p_on_conflict
    );
  ELSE
    SELECT string_agg(format('%I = EXCLUDED.%I', c.column_name, c.column_name), ', ')
    INTO upd_clause
    FROM information_schema.columns c
    WHERE c.table_schema = p_dest_schema
      AND c.table_name = p_dest_table
      AND NOT (c.column_name = ANY (conflict_cols))
      AND cbnet_import.dest_copyable(p_dest_schema, p_dest_table, c.column_name, src_t);

    IF upd_clause IS NULL OR upd_clause = '' THEN
      q := format(
        'INSERT INTO %I.%I (%s) SELECT %s FROM cbnet_import.%I s ON CONFLICT (%s) DO NOTHING',
        p_dest_schema, p_dest_table, src_cols, sel_cols, src_t, p_on_conflict
      );
    ELSE
      q := format(
        'INSERT INTO %I.%I (%s) SELECT %s FROM cbnet_import.%I s ON CONFLICT (%s) DO UPDATE SET %s',
        p_dest_schema, p_dest_table, src_cols, sel_cols, src_t, p_on_conflict, upd_clause
      );
    END IF;
  END IF;

  RAISE NOTICE 'copy_table %.% ← cbnet_import.%', p_dest_schema, p_dest_table, src_t;
  EXECUTE q;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;


-- ─── BLOCCO 2 — Bulk (disabilita trigger/FK) ────────────────────────────────
BEGIN;
SET LOCAL session_replication_role = replica;


-- ─── BLOCCO 3 — Lookup + remap UUID sedi/gruppi ─────────────────────────────
SELECT cbnet_import.sync_uffici();
SELECT cbnet_import.sync_by_codice('gruppi_compagnia', 'gruppo_compagnia_id');
SELECT cbnet_import.sync_by_codice('gruppi_finanziari', 'gruppo_finanziario_id');


-- ─── BLOCCO 4 — Compagnie / agenzie ─────────────────────────────────────────
SELECT cbnet_import.copy_table(
  'public', 'compagnie', 'id', false,
  ARRAY['gruppo_compagnia_id', 'gruppo_finanziario_id']
);
SELECT cbnet_import.copy_table('public', 'compagnia_rapporti', 'id');
SELECT cbnet_import.copy_table('public', 'compagnia_rapporto_rami', 'id');


-- ─── BLOCCO 5 — Anagrafiche professionali ───────────────────────────────────
SELECT cbnet_import.copy_table(
  'public', 'anagrafiche_professionali', 'id', false, ARRAY['ufficio_id']
);
SELECT cbnet_import.copy_table('public', 'produttori_provvigioni_ramo', 'id');


-- ─── BLOCCO 6 — Clienti ─────────────────────────────────────────────────────
SELECT cbnet_import.copy_table('public', 'clienti', 'id', false, ARRAY['ufficio_id']);
SELECT cbnet_import.copy_table('public', 'nominativi_cliente', 'id', true);
SELECT cbnet_import.copy_table('public', 'codici_commerciali_cliente', 'id', true);
SELECT cbnet_import.copy_table('public', 'clienti_intermediari_default', 'id', true);


-- ─── BLOCCO 7 — Controparti sinistri ────────────────────────────────────────
SELECT cbnet_import.copy_table('public', 'controparti_sinistri', 'id');
SELECT setval(
  pg_get_serial_sequence('public.controparti_sinistri', 'codice'),
  (SELECT COALESCE(MAX(codice), 1) FROM public.controparti_sinistri)
);


-- ─── BLOCCO 8 — Auth + Centro Utenti (senza colonne GENERATED) ─────────────
SELECT cbnet_import.copy_table('auth', 'users', 'id');
SELECT cbnet_import.copy_table('auth', 'identities', 'id');
SELECT cbnet_import.copy_table('public', 'profiles', 'id', false, ARRAY['ufficio_id']);
SELECT cbnet_import.copy_table('public', 'user_roles', 'user_id, role');
SELECT cbnet_import.copy_table(
  'public', 'profilo_sedi', 'profilo_id, ufficio_id', false, ARRAY['ufficio_id']
);


-- ─── BLOCCO 9 — Fine + pulizia opzionale ────────────────────────────────────
SET LOCAL session_replication_role = DEFAULT;
COMMIT;

-- Verifica (opzionale):
-- SELECT 'clienti' t, count(*) FROM public.clienti
-- UNION ALL SELECT 'profiles', count(*) FROM public.profiles
-- UNION ALL SELECT 'compagnie', count(*) FROM public.compagnie;

-- Pulizia FDW (opzionale, dopo verifica):
-- DROP SCHEMA IF EXISTS cbnet_import CASCADE;
-- DROP USER MAPPING IF EXISTS FOR postgres SERVER consulbrokers_src;
-- DROP SERVER IF EXISTS consulbrokers_src CASCADE;
