#!/usr/bin/env python3
"""
Genera SQL idempotente per import quietanze «Da generare» (portafoglio Napoli multi-sede).

Uso:
  python3 scripts/generate-napoli-quietanze-import.py \\
    /path/to/portafoglio_napoli_123e.CSV \\
    --out scripts/napoli-quietanze-import-20261016.sql

Il file SQL va eseguito in Supabase SQL Editor con ruolo privilegiato (postgres / service).
"""
from __future__ import annotations

import argparse
import csv
import re
import unicodedata
from datetime import datetime
from pathlib import Path

FILIALI_SKIP = {"1", "A1", "AS", "CV", "DM", "MN", "PC", "Z1"}
FILIALI_ALIAS = {"RM": "009", "RO": "RM2"}

UFFICI = {
    "009": "cdb3a9e1-2603-4147-819e-2bf5729c6731",
    "NA": "f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a",
    "SS": "69eeb144-7a6d-4de5-bac3-d22cbdb6b736",
    "SP": "1da8128c-909f-4d76-80a0-1dddc3c70c34",
    "RM2": "c83a748c-653f-4cbd-b075-b399eccdd1b1",
    "CT": "d2c47452-4bb2-4b3b-8a24-a1606357e909",
    "PZ": "e4f0d1f5-e344-4920-b178-d8754904a108",
    "BA": "b4b4b4b4-ba21-4ba1-8ba1-00000000ba21",
    "PA": "05727385-affb-4c21-80dd-1e218482307e",
    "MI": "193e0821-4105-4ad6-a72e-0ebb6c116797",
    "PR": "a0d09b81-777d-43be-9615-e9d051786e2c",
    "SA": "6153d82f-0e65-4862-81a0-52d438711640",
    "SD": "327e92f7-64f0-48b9-9e48-73611d8cb406",
    "CB": "ebd881c6-cc52-4fbe-a423-2bf1f8498e5c",
}

ID_LEGACY_BASE = 910_000_000


def trim(s: str | None) -> str:
    return (s or "").strip()


def norm_filiale(raw: str | None) -> str:
    return trim(str(raw or "")).upper()


def resolve_ufficio_codice(filiale: str | None) -> str | None:
    fil = norm_filiale(filiale)
    if not fil or fil in FILIALI_SKIP:
        return None
    cod = FILIALI_ALIAS.get(fil, fil)
    return cod if cod in UFFICI else None


def norm_numero(raw: str | None) -> str:
    return trim(str(raw or "")).rstrip(".")


def parse_date_it(raw: str | None) -> str | None:
    s = trim(raw)
    if not s:
        return None
    for fmt in ("%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_money(raw: str | None) -> float:
    s = trim(str(raw or "")).replace(" ", "").replace(",", ".")
    if not s:
        return 0.0
    try:
        return round(float(s), 2)
    except ValueError:
        return 0.0


def sql_str(v: str | None) -> str:
    if v is None or trim(v) == "":
        return "NULL"
    return "'" + trim(v).replace("'", "''") + "'"


def sql_num(v: float | int | None) -> str:
    if v is None:
        return "NULL"
    return str(v)


def sql_date(v: str | None) -> str:
    if not v:
        return "NULL"
    return f"'{v}'::date"


def row_tuple(ordine: int, r: dict, ufficio_cod: str) -> str:
    id_legacy = ID_LEGACY_BASE + ordine
    numero = norm_numero(r.get("Polizza"))
    return (
        f"({ordine}, {id_legacy}, {sql_str(numero)}, {sql_str(r.get('Codice'))}, "
        f"{sql_str(r.get('CodFiscale'))}, {sql_str(r.get('Nome'))}, "
        f"{sql_str(r.get('Compagnia'))}, {sql_str(r.get('Ramo'))}, {sql_str(r.get('Gruppo'))}, "
        f"{sql_date(parse_date_it(r.get('Data Comp')))}, "
        f"{sql_date(parse_date_it(r.get('Scad Polizza')))}, "
        f"{sql_date(parse_date_it(r.get('Scadenza')))}, "
        f"{sql_num(parse_money(r.get('Lordo')))}, "
        f"{sql_num(parse_money(r.get('Attive')))}, "
        f"{sql_num(parse_money(r.get('Passive')))}, "
        f"{sql_num(int(trim(r.get('Fraz') or '1') or '1'))}, "
        f"{sql_num(int(trim(r.get('RateFraz') or '0') or '0'))}, "
        f"{sql_str(r.get('Tipo Rinnovo'))}, {sql_str(r.get('A/E'))}, "
        f"{sql_str(r.get('Specialist'))}, {sql_str(r.get('Produttore'))}, "
        f"{sql_str(ufficio_cod)}, {sql_str(norm_filiale(r.get('Filiale')))}, "
        f"{sql_str(r.get('Descrizione'))}, {sql_str(r.get('NoteQuietanzamento'))}, "
        f"{sql_str(r.get('NotePolizza'))}, {sql_num(parse_money(r.get('%Ra Deleg')))})"
    )


def build_sql(rows: list[tuple[int, dict, str]]) -> str:
    values = ",\n".join(row_tuple(o, r, u) for o, r, u in rows)
    return f"""-- Import quietanze «Da generare» — portafoglio Napoli / multi-sede
-- Generato: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC
-- Righe sorgente eligibili: {len(rows)} (Filiale AS e filiali non mappate escluse in generator)
-- Eseguire in Supabase SQL Editor (ruolo postgres). Una transazione.

BEGIN;

ALTER TABLE public.titoli DISABLE TRIGGER trg_genera_quietanze_su_insert_madre;

CREATE TEMP TABLE tmp_napoli_quiet_src (
  ordine integer NOT NULL,
  id_legacy integer NOT NULL PRIMARY KEY,
  numero_norm text NOT NULL,
  cliente_codice text,
  cliente_cf text,
  cliente_nome text NOT NULL,
  compagnia_nome text NOT NULL,
  ramo_testo text,
  gruppo_testo text,
  data_comp date,
  scad_polizza date,
  scadenza date NOT NULL,
  premio_lordo numeric NOT NULL,
  provv_attive numeric NOT NULL,
  provv_passive numeric NOT NULL,
  fraz integer NOT NULL,
  rate_fraz integer NOT NULL,
  tipo_rinnovo text,
  ae_nome text,
  specialist text,
  produttore_nome text,
  ufficio_codice text NOT NULL,
  filiale text,
  descrizione text,
  note_quiet text,
  note_polizza text,
  perc_ra numeric
) ON COMMIT DROP;

INSERT INTO tmp_napoli_quiet_src (
  ordine, id_legacy, numero_norm, cliente_codice, cliente_cf, cliente_nome,
  compagnia_nome, ramo_testo, gruppo_testo, data_comp, scad_polizza, scadenza,
  premio_lordo, provv_attive, provv_passive, fraz, rate_fraz, tipo_rinnovo,
  ae_nome, specialist, produttore_nome, ufficio_codice, filiale,
  descrizione, note_quiet, note_polizza, perc_ra
) VALUES
{values};

CREATE TEMP VIEW tmp_napoli_resolved AS
SELECT
  s.*,
  u.id AS ufficio_id,
  cli.id AS cliente_id,
  comp.id AS compagnia_id,
  prod.id AS produttore_id,
  madre.id AS madre_id,
  madre.polizza_id AS polizza_id,
  madre.numero_titolo AS madre_numero,
  madre.riga AS madre_riga,
  coalesce(maxr.max_riga, madre.riga, 0) + 1 AS nuova_riga,
  madre.ramo_id AS ramo_id_madre,
  madre.compagnia_id AS compagnia_id_madre,
  madre.frazionamento AS frazionamento_madre,
  madre.periodicita AS periodicita_madre,
  madre.rate AS rate_madre,
  madre.tipo_incasso AS tipo_incasso_madre,
  madre.conto_incasso AS conto_incasso_madre,
  madre.tipo_portafoglio AS tipo_portafoglio_madre,
  madre.valuta AS valuta_madre,
  madre.cambio AS cambio_madre,
  madre.prodotto_nome AS prodotto_madre,
  madre.descrizione_polizza AS descrizione_madre,
  madre.percentuale_riparto AS riparto_madre,
  madre.premio_netto AS madre_netto,
  madre.tasse AS madre_tasse,
  madre.premio_lordo AS madre_lordo
FROM tmp_napoli_quiet_src s
JOIN public.uffici u ON upper(u.codice_ufficio) = upper(s.ufficio_codice)
LEFT JOIN LATERAL (
  SELECT c.id
  FROM public.clienti c
  WHERE c.attivo IS DISTINCT FROM false
    AND (
      upper(coalesce(c.codice_ricerca, c.codice_cliente, '')) = upper(coalesce(s.cliente_codice, ''))
      OR (
        s.cliente_cf IS NOT NULL AND length(trim(s.cliente_cf)) = 16
        AND upper(coalesce(c.codice_fiscale, '')) = upper(trim(s.cliente_cf))
      )
      OR (
        s.cliente_cf IS NOT NULL AND length(trim(s.cliente_cf)) = 11
        AND upper(coalesce(c.partita_iva, '')) = upper(trim(s.cliente_cf))
      )
      OR (
        s.cliente_cf IS NOT NULL AND length(trim(s.cliente_cf)) BETWEEN 11 AND 16
        AND (
          upper(coalesce(c.codice_fiscale, '')) = upper(trim(s.cliente_cf))
          OR upper(coalesce(c.partita_iva, '')) = upper(trim(s.cliente_cf))
        )
      )
      OR (
        length(regexp_replace(upper(s.cliente_nome), '[^A-Z0-9]', '', 'g')) >= 8
        AND regexp_replace(upper(coalesce(c.ragione_sociale, concat_ws(' ', c.nome, c.cognome), '')), '[^A-Z0-9]', '', 'g')
            = regexp_replace(upper(s.cliente_nome), '[^A-Z0-9]', '', 'g')
      )
    )
  ORDER BY
    CASE WHEN upper(coalesce(c.codice_ricerca, c.codice_cliente, '')) = upper(coalesce(s.cliente_codice, '')) THEN 0 ELSE 1 END,
    CASE WHEN c.ufficio_id = u.id THEN 0 ELSE 1 END,
    c.created_at
  LIMIT 1
) cli ON true
LEFT JOIN LATERAL (
  SELECT c.id
  FROM public.compagnie c
  WHERE c.attiva IS DISTINCT FROM false
    AND (
      regexp_replace(upper(c.nome), '[^A-Z0-9]', '', 'g')
        LIKE '%' || regexp_replace(substring(upper(s.compagnia_nome) from 1 for 12), '[^A-Z0-9]', '', 'g') || '%'
      OR regexp_replace(upper(s.compagnia_nome), '[^A-Z0-9]', '', 'g')
        LIKE '%' || regexp_replace(substring(upper(c.nome) from 1 for 12), '[^A-Z0-9]', '', 'g') || '%'
    )
  ORDER BY length(c.nome)
  LIMIT 1
) comp ON true
LEFT JOIN LATERAL (
  SELECT a.id
  FROM public.anagrafiche_professionali a
  WHERE a.attivo IS DISTINCT FROM false
    AND s.produttore_nome IS NOT NULL
    AND regexp_replace(upper(coalesce(a.cognome, a.ragione_sociale, concat_ws(' ', a.nome, a.cognome))), '[^A-Z0-9]', '', 'g')
        LIKE '%' || regexp_replace(upper(split_part(s.produttore_nome, '/', 1)), '[^A-Z0-9]', '', 'g') || '%'
  ORDER BY CASE WHEN a.ufficio_id = u.id THEN 0 ELSE 1 END, a.created_at
  LIMIT 1
) prod ON s.produttore_nome IS NOT NULL
LEFT JOIN LATERAL (
  SELECT t.*
  FROM public.titoli t
  WHERE regexp_replace(upper(trim(t.numero_titolo)), '[._]+$', '', 'g') = s.numero_norm
    AND t.sostituisce_polizza IS NULL
    AND coalesce(t.is_appendice_modifica, false) = false
    AND coalesce(t.is_proroga, false) = false
    AND coalesce(t.is_regolazione, false) = false
  ORDER BY
    CASE WHEN t.ufficio_id = u.id THEN 0 ELSE 1 END,
    t.riga,
    t.created_at
  LIMIT 1
) madre ON true
LEFT JOIN LATERAL (
  SELECT max(t.riga) AS max_riga
  FROM public.titoli t
  WHERE regexp_replace(upper(trim(t.numero_titolo)), '[._]+$', '', 'g') = s.numero_norm
) maxr ON true;

-- Diagnostica pre-insert (commenta il RAISE se vuoi solo il report)
DO $$
DECLARE
  v_tot integer;
  v_ok integer;
  v_no_cli text;
  v_no_comp text;
  v_no_madre text;
BEGIN
  SELECT count(*) INTO v_tot FROM tmp_napoli_quiet_src;
  SELECT count(*) INTO v_ok FROM tmp_napoli_resolved r
  WHERE r.cliente_id IS NOT NULL
    AND coalesce(r.compagnia_id_madre, r.compagnia_id) IS NOT NULL
    AND r.madre_id IS NOT NULL;
  SELECT string_agg(DISTINCT cliente_codice || ' ' || left(cliente_nome, 30), '; ')
    INTO v_no_cli FROM tmp_napoli_resolved WHERE cliente_id IS NULL;
  SELECT string_agg(DISTINCT left(compagnia_nome, 40), '; ')
    INTO v_no_comp FROM tmp_napoli_resolved WHERE compagnia_id IS NULL;
  SELECT string_agg(DISTINCT numero_norm, ', ')
    INTO v_no_madre FROM tmp_napoli_resolved WHERE madre_id IS NULL;
  RAISE NOTICE 'Napoli quietanze: sorgente %, pronte %', v_tot, v_ok;
  IF v_no_cli IS NOT NULL THEN RAISE NOTICE 'Clienti non risolti: %', v_no_cli; END IF;
  IF v_no_comp IS NOT NULL THEN RAISE NOTICE 'Compagnie non risolte: %', v_no_comp; END IF;
  IF v_no_madre IS NOT NULL THEN RAISE NOTICE 'Polizze madre assenti: %', v_no_madre; END IF;
END $$;

INSERT INTO public.titoli (
  numero_titolo, riga, stato,
  cliente_anagrafica_id, compagnia_id, ramo_id, ufficio_id, polizza_id,
  anagrafica_commerciale_id, produttore_nome, specialist, ae_nome,
  prodotto_nome, descrizione_polizza,
  durata_da, durata_a, garanzia_da, garanzia_a, data_scadenza, data_competenza,
  premio_netto, tasse, premio_lordo,
  premio_netto_quietanza, tasse_quietanza,
  provvigioni_firma, provvigioni_quietanza,
  percentuale_commerciale, percentuale_riparto,
  frazionamento, periodicita, rate, tacito_rinnovo,
  tipo_incasso, conto_incasso, tipo_portafoglio,
  valuta, cambio, filiale, id_legacy,
  sostituisce_polizza, sostituisce_riga, note
)
SELECT
  r.numero_norm,
  r.nuova_riga,
  'attivo',
  r.cliente_id,
  coalesce(r.compagnia_id_madre, r.compagnia_id),
  r.ramo_id_madre,
  r.ufficio_id,
  coalesce(r.polizza_id, r.madre_id),
  r.produttore_id,
  r.produttore_nome,
  r.specialist,
  r.ae_nome,
  coalesce(r.prodotto_madre, nullif(r.gruppo_testo, ''), r.ramo_testo),
  coalesce(r.descrizione, r.descrizione_madre),
  coalesce(r.data_comp, r.scadenza - interval '1 year')::date,
  r.scad_polizza,
  coalesce(r.data_comp, r.scadenza - interval '1 year')::date,
  r.scadenza,
  r.scadenza,
  coalesce(r.data_comp, r.scadenza - interval '1 year')::date,
  CASE
    WHEN coalesce(r.madre_lordo, 0) > 0 THEN round(r.premio_lordo * r.madre_netto / r.madre_lordo, 2)
    ELSE round(r.premio_lordo * 0.85, 2)
  END,
  CASE
    WHEN coalesce(r.madre_lordo, 0) > 0 THEN round(r.premio_lordo - (r.premio_lordo * r.madre_netto / r.madre_lordo), 2)
    ELSE round(r.premio_lordo * 0.15, 2)
  END,
  r.premio_lordo,
  CASE
    WHEN coalesce(r.madre_lordo, 0) > 0 THEN round(r.premio_lordo * r.madre_netto / r.madre_lordo, 2)
    ELSE round(r.premio_lordo * 0.85, 2)
  END,
  CASE
    WHEN coalesce(r.madre_lordo, 0) > 0 THEN round(r.premio_lordo - (r.premio_lordo * r.madre_netto / r.madre_lordo), 2)
    ELSE round(r.premio_lordo * 0.15, 2)
  END,
  r.provv_attive,
  r.provv_attive,
  CASE WHEN r.provv_attive <> 0 THEN round(abs(r.provv_passive / r.provv_attive) * 100, 4) ELSE 0 END,
  coalesce(r.riparto_madre, 100),
  coalesce(r.frazionamento_madre, CASE r.fraz WHEN 2 THEN 'Semestrale' WHEN 3 THEN 'Quadrimestrale' WHEN 4 THEN 'Trimestrale' ELSE 'Annuale' END),
  coalesce(r.periodicita_madre, r.frazionamento_madre, 'Annuale'),
  coalesce(r.rate_madre, r.fraz, 1),
  coalesce(r.tipo_rinnovo, 'R') = 'R',
  r.tipo_incasso_madre,
  r.conto_incasso_madre,
  r.tipo_portafoglio_madre,
  coalesce(r.valuta_madre, 'EUR'),
  coalesce(r.cambio_madre, 1),
  r.filiale,
  r.id_legacy,
  r.madre_numero,
  r.madre_riga,
  concat_ws(E'\\n',
    'Import quietanze Da generare Napoli 2026-10-16',
    nullif(r.note_quiet, ''),
    nullif(r.note_polizza, '')
  )
FROM tmp_napoli_resolved r
WHERE r.cliente_id IS NOT NULL
  AND coalesce(r.compagnia_id_madre, r.compagnia_id) IS NOT NULL
  AND r.madre_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.titoli t WHERE t.id_legacy = r.id_legacy)
  AND NOT EXISTS (
    SELECT 1 FROM public.titoli t
    WHERE regexp_replace(upper(trim(t.numero_titolo)), '[._]+$', '', 'g') = r.numero_norm
      AND t.sostituisce_polizza IS NOT NULL
      AND t.garanzia_a = r.scadenza
      AND abs(coalesce(t.premio_lordo, 0) - r.premio_lordo) < 0.05
  );

ALTER TABLE public.titoli ENABLE TRIGGER trg_genera_quietanze_su_insert_madre;

-- Riepilogo post-insert
SELECT
  (SELECT count(*) FROM tmp_napoli_quiet_src) AS righe_file,
  (SELECT count(*) FROM tmp_napoli_resolved r
   WHERE r.cliente_id IS NOT NULL
     AND coalesce(r.compagnia_id_madre, r.compagnia_id) IS NOT NULL
     AND r.madre_id IS NOT NULL) AS righe_risolte,
  (SELECT count(*) FROM public.titoli t WHERE t.id_legacy BETWEEN {ID_LEGACY_BASE} AND {ID_LEGACY_BASE + 999999}) AS titoli_inseriti_questo_run;

COMMIT;
"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_path", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    eligible: list[tuple[int, dict, str]] = []
    ordine = 0
    with args.csv_path.open(encoding="cp1252", errors="replace") as f:
        for row in csv.DictReader(f, delimiter=";"):
            u = resolve_ufficio_codice(row.get("Filiale"))
            if not u:
                continue
            ordine += 1
            eligible.append((ordine, row, u))

    sql = build_sql(eligible)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(sql, encoding="utf-8")
    print(f"Scritto {args.out} — {len(eligible)} righe eligibili, {args.out.stat().st_size // 1024} KiB")


if __name__ == "__main__":
    main()
