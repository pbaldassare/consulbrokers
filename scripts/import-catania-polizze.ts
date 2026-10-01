/**
 * Genera l'import SQL idempotente del portafoglio Catania.
 *
 * Il file prodotto va applicato come singola transazione con un ruolo DB
 * privilegiato. Lo script non scrive direttamente su Supabase.
 *
 * Regole:
 * - PI = polizza/prima rata; PQ = sole rate successive.
 * - Se manca PI, la prima PQ viene promossa a polizza.
 * - Nessuna figlia 1/1 e nessun frontespizio fittizio.
 * - AM sempre nidificata; le due AM senza madre concordate vengono escluse.
 * - PS collegato al titolo positivo; la madre resta annullata se non c'è un
 *   rinnovo positivo successivo.
 * - Numeri già presenti non vengono duplicati.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import {
  groupCataniaPolizze,
  mapCataniaAe,
  mapCataniaCompagnia,
  mapCataniaProduttore,
  mapCataniaRamo,
  mapCataniaSpecialist,
  normalizeCataniaNumero,
  type CataniaPolizzaRiga,
} from "../src/lib/cataniaPolizze.ts";
import {
  excelSerialToIso,
  mapRateToFrazionamento,
  money,
  trimTxt,
} from "../src/lib/campobassoPolizze.ts";

const EXCEL =
  process.argv.find((arg) => arg.endsWith(".xlsx")) ||
  "/root/.cursor/projects/home-ubuntu-cursor-projects-cbnet/uploads/polizze_sede_Catania_e8ae.xlsx";
const OUT =
  process.argv.find((arg) => arg.startsWith("--out="))?.slice("--out=".length) ||
  "/tmp/catania-polizze-import.sql";
const PLAN = "/tmp/catania-polizze-plan.json";
const STAGING_DIR = "/tmp/catania-polizze-staging";
const STAGING_JSON = "/tmp/catania-polizze-staging.json";
const CATANIA_UFFICIO_ID = "d2c47452-4bb2-4b3b-8a24-a1606357e909";

type Source = {
  ordine: number;
  idLegacy: number;
  tipo: string;
  numeroRaw: string;
  numero: string;
  clienteCodice: string;
  clienteNome: string;
  compagniaRaw: string;
  compagnia: string;
  ramoRaw: string;
  ramo: string;
  ramoNome: string;
  appendice: string | null;
  descrizione: string | null;
  cig: string | null;
  inizPol: string | null;
  scadPol: string | null;
  inizGar: string | null;
  scadGar: string | null;
  compContabile: string | null;
  compAssicurativa: string | null;
  dataCopertura: string | null;
  dataIncasso: string | null;
  premio: number;
  imponibile: number;
  tasse: number;
  attive: number;
  passive: number;
  riparto: number;
  rate: number;
  frazionamento: string;
  rinnovo: string | null;
  specialist: string | null;
  ae: string | null;
  produttore: string | null;
  tipoIncasso: string | null;
  contoIncasso: string | null;
  tipoPortafoglio: string | null;
  cambio: number;
  mesiDisdetta: number | null;
};

function sqlString(value: string | null | undefined): string {
  if (value == null || value === "") return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlDate(value: string | null): string {
  return value ? `${sqlString(value)}::date` : "NULL";
}

function sqlNumber(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "NULL" : String(value);
}

function sourceRow(row: CataniaPolizzaRiga, index: number): Source {
  const rawId = Number(row.ID);
  if (!Number.isInteger(rawId)) throw new Error(`ID gestionale non valido alla riga ${index + 2}`);
  const rawRate = Number(row.Rate);
  const rate = Number.isFinite(rawRate) && rawRate > 0 ? rawRate : 1;
  const mesi = Number(row["Mesi Disd"]);
  return {
    ordine: index + 1,
    idLegacy: rawId,
    tipo: trimTxt(row.TipoDoc || row.TipoTit).toUpperCase(),
    numeroRaw: trimTxt(row.Polizza),
    numero: normalizeCataniaNumero(row.Polizza),
    clienteCodice: trimTxt(row.CdClie).toUpperCase(),
    clienteNome: trimTxt(row["Nome CLiente"]),
    compagniaRaw: trimTxt(row.CdComp).toUpperCase(),
    compagnia: mapCataniaCompagnia(row.CdComp),
    ramoRaw: trimTxt(row.CdRamo).toUpperCase(),
    ramo: mapCataniaRamo(row.CdRamo),
    ramoNome: trimTxt(row.Ramo),
    appendice: trimTxt(row.Appendice) || null,
    descrizione: trimTxt(row.Descrizione) || null,
    cig: trimTxt(row["Rif/Cig"]) || null,
    inizPol: excelSerialToIso(row["Iniz Pol"]),
    scadPol: excelSerialToIso(row["Scad Pol"]),
    inizGar: excelSerialToIso(row["Iniz Gar"]),
    scadGar: excelSerialToIso(row["Scad Gar"]),
    compContabile: excelSerialToIso(row.Comp_Contabile),
    compAssicurativa: excelSerialToIso(row.Comp_Assicurativa),
    dataCopertura: excelSerialToIso(row["Dt Copertura"]),
    dataIncasso: excelSerialToIso(row["Dt Incasso"]),
    premio: money(row.Premio),
    imponibile: money(row.Imponibile),
    tasse: money(row.Tasse),
    attive: money(row.Attive),
    passive: money(row.Passive),
    riparto: money(row["%Riparto"]) || 100,
    rate,
    frazionamento: mapRateToFrazionamento(rate),
    rinnovo: trimTxt(row.Rinnovo).toUpperCase() || null,
    specialist: mapCataniaSpecialist(row["Nome Specialist"]),
    ae: mapCataniaAe(row["Nome A/E"]),
    produttore: mapCataniaProduttore(row["Nome Produttore"]),
    tipoIncasso: trimTxt(row.TipoInc) || null,
    contoIncasso: trimTxt(row.ContoInc) || null,
    tipoPortafoglio: trimTxt(row["Tipo Portafoglio"]) || null,
    cambio: money(row.Cambio) || 1,
    mesiDisdetta: Number.isFinite(mesi) && mesi !== 0 ? mesi : null,
  };
}

function valueSql(row: Source): string {
  return `(${[
    row.ordine,
    row.idLegacy,
    sqlString(row.tipo),
    sqlString(row.numeroRaw),
    sqlString(row.numero),
    sqlString(row.clienteCodice),
    sqlString(row.clienteNome),
    sqlString(row.compagniaRaw),
    sqlString(row.compagnia),
    sqlString(row.ramoRaw),
    sqlString(row.ramo),
    sqlString(row.ramoNome),
    sqlString(row.appendice),
    sqlString(row.descrizione),
    sqlString(row.cig),
    sqlDate(row.inizPol),
    sqlDate(row.scadPol),
    sqlDate(row.inizGar),
    sqlDate(row.scadGar),
    sqlDate(row.compContabile),
    sqlDate(row.compAssicurativa),
    sqlDate(row.dataCopertura),
    sqlDate(row.dataIncasso),
    sqlNumber(row.premio),
    sqlNumber(row.imponibile),
    sqlNumber(row.tasse),
    sqlNumber(row.attive),
    sqlNumber(row.passive),
    sqlNumber(row.riparto),
    sqlNumber(row.rate),
    sqlString(row.frazionamento),
    sqlString(row.rinnovo),
    sqlString(row.specialist),
    sqlString(row.ae),
    sqlString(row.produttore),
    sqlString(row.tipoIncasso),
    sqlString(row.contoIncasso),
    sqlString(row.tipoPortafoglio),
    sqlNumber(row.cambio),
    sqlNumber(row.mesiDisdetta),
  ].join(", ")})`;
}

function stagingJsonRow(row: Source) {
  return {
    ordine: row.ordine,
    id_legacy: row.idLegacy,
    tipo: row.tipo,
    numero_raw: row.numeroRaw,
    numero_norm: row.numero,
    cliente_codice: row.clienteCodice,
    cliente_nome: row.clienteNome,
    compagnia_raw: row.compagniaRaw,
    compagnia_codice: row.compagnia,
    ramo_raw: row.ramoRaw,
    ramo_codice: row.ramo,
    ramo_nome: row.ramoNome,
    appendice: row.appendice,
    descrizione: row.descrizione,
    cig: row.cig,
    iniz_pol: row.inizPol,
    scad_pol: row.scadPol,
    iniz_gar: row.inizGar,
    scad_gar: row.scadGar,
    comp_contabile: row.compContabile,
    comp_assicurativa: row.compAssicurativa,
    data_copertura: row.dataCopertura,
    data_incasso: row.dataIncasso,
    premio: row.premio,
    imponibile: row.imponibile,
    tasse: row.tasse,
    attive: row.attive,
    passive: row.passive,
    riparto: row.riparto,
    rate: row.rate,
    frazionamento: row.frazionamento,
    rinnovo: row.rinnovo,
    specialist: row.specialist,
    ae_nome: row.ae,
    produttore_nome: row.produttore,
    tipo_incasso: row.tipoIncasso,
    conto_incasso: row.contoIncasso,
    tipo_portafoglio: row.tipoPortafoglio,
    cambio: row.cambio,
    mesi_disdetta: row.mesiDisdetta,
  };
}

function buildSql(rows: Source[]): string {
  const values = rows.map(valueSql).join(",\n");
  return `BEGIN;

-- Anagrafiche autorizzate dal broker.
INSERT INTO public.compagnie (codice, nome, attiva, tipo, gruppo_compagnia_id)
SELECT 'LIC000', 'LLOYD''S INSURANCE COMPANY S.A. MILANO', true, 'agenzia',
       '5f9da355-a4b2-4707-9601-75fd3d333283'::uuid
WHERE NOT EXISTS (SELECT 1 FROM public.compagnie WHERE upper(codice) = 'LIC000');

INSERT INTO public.compagnie (codice, nome, attiva, tipo, gruppo_compagnia_id)
SELECT 'UNISCI', 'SCIACCA ASSICURAZIONI SRL UNIPOLSAI ASS.NI TAORMINA', true, 'agenzia',
       '8d394866-aab5-4b07-a9d3-b718801cf16f'::uuid
WHERE NOT EXISTS (SELECT 1 FROM public.compagnie WHERE upper(codice) = 'UNISCI');

INSERT INTO public.anagrafiche_professionali
  (tipo, ruoli, nome, cognome, ragione_sociale, ufficio_id, attivo, note)
SELECT 'corrispondente', ARRAY['corrispondente']::text[], v.nome, v.cognome,
       concat_ws(' ', v.cognome, v.nome), '${CATANIA_UFFICIO_ID}'::uuid, true,
       'Creato per import portafoglio Catania 01/10/2026'
FROM (VALUES
  ('Marco', 'Rapisarda'),
  ('Valentina Rita', 'Piccoli'),
  ('Tiziana', 'Saglimbene')
) AS v(nome, cognome)
WHERE NOT EXISTS (
  SELECT 1 FROM public.anagrafiche_professionali a
  WHERE a.attivo IS DISTINCT FROM false
    AND regexp_replace(upper(concat_ws(' ', a.cognome, a.nome)), '[^A-Z0-9]', '', 'g')
        = regexp_replace(upper(concat_ws(' ', v.cognome, v.nome)), '[^A-Z0-9]', '', 'g')
);

INSERT INTO public.clienti
  (codice_ricerca, tipo_cliente, tipo_persona, ufficio_id, attivo, stato_cliente,
   nome, cognome, email, gruppo_statistico, note)
SELECT v.codice, 'privato', 'F', '${CATANIA_UFFICIO_ID}'::uuid, true, 'Attivo',
       v.nome, v.cognome, 'catania@consulbrokers.it', 'PERSONE',
       'Creato da portafoglio polizze Catania 01/10/2026'
FROM (VALUES
  ('017807', 'Gaetano Salvatore', 'Canfarelli'),
  ('017808', 'Mattia', 'De Riggi'),
  ('017809', 'Claudio', 'Fiorilla'),
  ('017810', 'Giuliana', 'Maccarone'),
  ('017811', 'Cristina', 'Mauceri'),
  ('017812', 'Rossella', 'Monte'),
  ('017813', 'Annalisa', 'Parisi')
) AS v(codice, nome, cognome)
WHERE NOT EXISTS (
  SELECT 1 FROM public.clienti c
  WHERE c.attivo IS DISTINCT FROM false AND upper(coalesce(c.codice_ricerca, '')) = v.codice
);

CREATE TEMP TABLE tmp_catania_src (
  ordine integer NOT NULL,
  id_legacy integer NOT NULL,
  tipo text NOT NULL,
  numero_raw text NOT NULL,
  numero_norm text NOT NULL,
  cliente_codice text NOT NULL,
  cliente_nome text NOT NULL,
  compagnia_raw text NOT NULL,
  compagnia_codice text NOT NULL,
  ramo_raw text NOT NULL,
  ramo_codice text NOT NULL,
  ramo_nome text,
  appendice text,
  descrizione text,
  cig text,
  iniz_pol date,
  scad_pol date,
  iniz_gar date,
  scad_gar date,
  comp_contabile date,
  comp_assicurativa date,
  data_copertura date,
  data_incasso date,
  premio numeric NOT NULL,
  imponibile numeric NOT NULL,
  tasse numeric NOT NULL,
  attive numeric NOT NULL,
  passive numeric NOT NULL,
  riparto numeric NOT NULL,
  rate integer NOT NULL,
  frazionamento text NOT NULL,
  rinnovo text,
  specialist text,
  ae_nome text,
  produttore_nome text,
  tipo_incasso text,
  conto_incasso text,
  tipo_portafoglio text,
  cambio numeric NOT NULL,
  mesi_disdetta numeric
) ON COMMIT DROP;

INSERT INTO tmp_catania_src VALUES
${values};

CREATE TEMP TABLE tmp_catania_existing_numbers ON COMMIT DROP AS
SELECT DISTINCT regexp_replace(upper(trim(numero_titolo)), '[._]+$', '', 'g') AS numero_norm
FROM public.titoli
WHERE numero_titolo IS NOT NULL;

CREATE TEMP VIEW tmp_catania_resolved AS
SELECT s.*,
       cli.id AS cliente_id,
       comp.id AS compagnia_id,
       ramo.id AS ramo_id,
       prod.id AS produttore_id,
       ae.id AS ae_id
FROM tmp_catania_src s
LEFT JOIN LATERAL (
  SELECT c.id
  FROM public.clienti c
  WHERE c.attivo IS DISTINCT FROM false
    AND (
      upper(coalesce(c.codice_ricerca, '')) = s.cliente_codice
      OR (s.cliente_codice = '006975' AND upper(coalesce(c.ragione_sociale, '')) LIKE '%SANTA MARINA SALINA%')
      OR (s.cliente_codice = '017736' AND upper(coalesce(c.ragione_sociale, '')) LIKE '%BIANCAVILLA%')
    )
  ORDER BY
    CASE WHEN upper(coalesce(c.codice_ricerca, '')) = s.cliente_codice THEN 0 ELSE 1 END,
    CASE WHEN c.ufficio_id = '${CATANIA_UFFICIO_ID}'::uuid THEN 0 ELSE 1 END,
    c.created_at
  LIMIT 1
) cli ON true
LEFT JOIN LATERAL (
  SELECT c.id FROM public.compagnie c
  WHERE upper(c.codice) = s.compagnia_codice AND c.attiva IS DISTINCT FROM false
  ORDER BY c.created_at LIMIT 1
) comp ON true
LEFT JOIN LATERAL (
  SELECT r.id FROM public.rami r
  WHERE upper(r.codice) = s.ramo_codice AND r.attivo IS DISTINCT FROM false
  ORDER BY r.created_at LIMIT 1
) ramo ON true
LEFT JOIN LATERAL (
  SELECT a.id
  FROM public.anagrafiche_professionali a
  WHERE a.attivo IS DISTINCT FROM false
    AND regexp_replace(
          upper(concat_ws(' ', a.nome, a.cognome, a.ragione_sociale)),
          '[^A-Z0-9]', '', 'g'
        ) LIKE '%' || regexp_replace(upper(coalesce(s.produttore_nome, '')), '[^A-Z0-9]', '', 'g') || '%'
  ORDER BY CASE WHEN a.ufficio_id = '${CATANIA_UFFICIO_ID}'::uuid THEN 0 ELSE 1 END, a.created_at
  LIMIT 1
) prod ON s.produttore_nome IS NOT NULL
LEFT JOIN LATERAL (
  SELECT a.id
  FROM public.anagrafiche_professionali a
  WHERE s.ae_nome = 'RONDINELLA SALVATORE'
    AND upper(concat_ws(' ', a.nome, a.cognome, a.ragione_sociale)) LIKE '%RONDINELLA%SALVATORE%'
  ORDER BY a.created_at LIMIT 1
) ae ON true;

DO $$
DECLARE
  v_rows integer;
  v_missing_clienti text;
  v_missing_compagnie text;
  v_missing_rami text;
  v_missing_produttori text;
BEGIN
  SELECT count(*) INTO v_rows FROM tmp_catania_src;
  IF v_rows <> 196 THEN RAISE EXCEPTION 'Attese 196 righe, trovate %', v_rows; END IF;
  SELECT string_agg(DISTINCT cliente_codice, ', ') INTO v_missing_clienti
  FROM tmp_catania_resolved WHERE cliente_id IS NULL;
  SELECT string_agg(DISTINCT compagnia_codice, ', ') INTO v_missing_compagnie
  FROM tmp_catania_resolved WHERE compagnia_id IS NULL;
  SELECT string_agg(DISTINCT ramo_codice, ', ') INTO v_missing_rami
  FROM tmp_catania_resolved WHERE ramo_id IS NULL;
  SELECT string_agg(DISTINCT produttore_nome, ', ') INTO v_missing_produttori
  FROM tmp_catania_resolved WHERE produttore_id IS NULL;
  IF v_missing_clienti IS NOT NULL THEN RAISE EXCEPTION 'Clienti non risolti: %', v_missing_clienti; END IF;
  IF v_missing_compagnie IS NOT NULL THEN RAISE EXCEPTION 'Compagnie non risolte: %', v_missing_compagnie; END IF;
  IF v_missing_rami IS NOT NULL THEN RAISE EXCEPTION 'Rami non risolti: %', v_missing_rami; END IF;
  IF v_missing_produttori IS NOT NULL THEN RAISE EXCEPTION 'Produttori non risolti: %', v_missing_produttori; END IF;
END $$;

-- I titoli sorgente contengono già le rate reali: impedisce figli automatici.
ALTER TABLE public.titoli DISABLE TRIGGER trg_genera_quietanze_su_insert_madre;

-- PI, oppure prima PQ quando PI manca. I numeri già esistenti non si duplicano.
WITH ranked AS (
  SELECT r.*,
         bool_or(tipo = 'PI') OVER gruppo AS has_pi,
         row_number() OVER (
           PARTITION BY numero_norm, compagnia_codice, cliente_codice
           ORDER BY
             CASE WHEN tipo = 'PI' THEN 0 WHEN tipo = 'PQ' THEN 1 ELSE 2 END,
             coalesce(iniz_gar, iniz_pol), ordine
         ) AS gruppo_rank
  FROM tmp_catania_resolved r
  WHERE tipo IN ('PI', 'PQ')
  WINDOW gruppo AS (PARTITION BY numero_norm, compagnia_codice, cliente_codice)
),
madri AS (
  SELECT *
  FROM ranked r
  WHERE gruppo_rank = 1
    AND NOT EXISTS (
      SELECT 1 FROM tmp_catania_existing_numbers e WHERE e.numero_norm = r.numero_norm
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.titoli t WHERE t.id_legacy = r.id_legacy
    )
)
INSERT INTO public.titoli (
  numero_titolo, riga, stato, cliente_anagrafica_id,
  compagnia_id, ramo_id, ufficio_id,
  anagrafica_commerciale_id, produttore_nome, specialist, ae_anagrafica_id, ae_nome,
  prodotto_nome, descrizione_polizza, cig_rif,
  durata_da, durata_a, garanzia_da, garanzia_a, data_scadenza, data_competenza,
  data_copertura, data_messa_cassa, data_incasso, importo_incassato,
  premio_netto, tasse, premio_lordo,
  premio_netto_quietanza, tasse_quietanza,
  provvigioni_firma, provvigioni_quietanza,
  percentuale_commerciale, percentuale_riparto,
  frazionamento, periodicita, rate, anni_durata, tacito_rinnovo,
  tipo_incasso, conto_incasso, tipo_portafoglio,
  valuta, cambio, filiale, id_legacy, comp_contabile, comp_assicurativa, note
)
SELECT
  m.numero_norm, 1,
  CASE WHEN m.data_incasso IS NULL THEN 'attivo' ELSE 'incassato' END,
  m.cliente_id, m.compagnia_id, m.ramo_id, '${CATANIA_UFFICIO_ID}'::uuid,
  m.produttore_id, m.produttore_nome, m.specialist, m.ae_id, m.ae_nome,
  nullif(m.ramo_nome, ''), m.descrizione, m.cig,
  coalesce(m.iniz_pol, m.iniz_gar), coalesce(m.scad_pol, m.scad_gar),
  coalesce(m.iniz_gar, m.iniz_pol), coalesce(m.scad_gar, m.scad_pol),
  coalesce(m.scad_pol, m.scad_gar), coalesce(m.iniz_pol, m.iniz_gar),
  m.data_copertura, m.data_incasso, m.data_incasso,
  CASE WHEN m.data_incasso IS NULL THEN NULL ELSE m.premio END,
  m.imponibile, m.tasse, m.premio,
  m.imponibile, m.tasse, m.attive, m.attive,
  CASE WHEN m.produttore_id IS NOT NULL AND m.attive <> 0
       THEN round(abs(m.passive / m.attive) * 100, 4) ELSE 0 END,
  m.riparto, m.frazionamento, m.frazionamento, m.rate,
  greatest(1, round(
    (coalesce(m.scad_pol, m.scad_gar) - coalesce(m.iniz_pol, m.iniz_gar))::numeric / 365
  )::integer),
  m.rinnovo = 'R',
  CASE WHEN m.data_incasso IS NULL THEN NULL ELSE m.tipo_incasso END,
  CASE WHEN m.data_incasso IS NULL THEN NULL ELSE m.conto_incasso END,
  m.tipo_portafoglio, 'EUR', m.cambio, 'CT', m.id_legacy,
  m.comp_contabile, m.comp_assicurativa,
  concat_ws(E'\\n',
    CASE WHEN NOT m.has_pi THEN 'Polizza promossa da PQ: PI assente nel file' END,
    CASE WHEN m.mesi_disdetta IS NOT NULL THEN 'Mesi disdetta gestionale: ' || m.mesi_disdetta END,
    'Import Catania 01/10/2026'
  )
FROM madri m;

-- PQ successive della nuova polizza.
WITH pq AS (
  SELECT r.*,
         bool_or(tipo = 'PI') OVER gruppo AS has_pi,
         sum(CASE WHEN tipo = 'PQ' THEN 1 ELSE 0 END) OVER (
           PARTITION BY numero_norm, compagnia_codice, cliente_codice
           ORDER BY coalesce(iniz_gar, iniz_pol), ordine
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ) AS pq_rank
  FROM tmp_catania_resolved r
  WINDOW gruppo AS (PARTITION BY numero_norm, compagnia_codice, cliente_codice)
),
figlie AS (
  SELECT p.*,
         CASE WHEN has_pi THEN pq_rank + 1 ELSE pq_rank END AS numero_riga
  FROM pq p
  WHERE p.tipo = 'PQ'
    AND (p.has_pi OR p.pq_rank > 1)
    AND NOT EXISTS (
      SELECT 1 FROM tmp_catania_existing_numbers e WHERE e.numero_norm = p.numero_norm
    )
    AND NOT EXISTS (SELECT 1 FROM public.titoli t WHERE t.id_legacy = p.id_legacy)
)
INSERT INTO public.titoli (
  numero_titolo, riga, stato, cliente_anagrafica_id,
  compagnia_id, ramo_id, ufficio_id, polizza_id,
  anagrafica_commerciale_id, produttore_nome, specialist, ae_anagrafica_id, ae_nome,
  prodotto_nome, descrizione_polizza, cig_rif,
  durata_da, durata_a, garanzia_da, garanzia_a, data_scadenza, data_competenza,
  data_copertura, data_messa_cassa, data_incasso, importo_incassato,
  premio_netto, tasse, premio_lordo,
  premio_netto_quietanza, tasse_quietanza,
  provvigioni_firma, provvigioni_quietanza,
  percentuale_commerciale, percentuale_riparto,
  frazionamento, periodicita, rate, anni_durata, tacito_rinnovo,
  tipo_incasso, conto_incasso, tipo_portafoglio,
  valuta, cambio, filiale, id_legacy, comp_contabile, comp_assicurativa,
  sostituisce_polizza, sostituisce_riga, note
)
SELECT
  f.numero_norm, f.numero_riga,
  CASE WHEN f.data_incasso IS NULL THEN 'attivo' ELSE 'incassato' END,
  f.cliente_id, f.compagnia_id, f.ramo_id, '${CATANIA_UFFICIO_ID}'::uuid,
  madre.polizza_id,
  f.produttore_id, f.produttore_nome, f.specialist, f.ae_id, f.ae_nome,
  nullif(f.ramo_nome, ''), f.descrizione, f.cig,
  coalesce(f.iniz_pol, f.iniz_gar), coalesce(f.scad_pol, f.scad_gar),
  coalesce(f.iniz_gar, f.iniz_pol), coalesce(f.scad_gar, f.scad_pol),
  coalesce(f.scad_gar, f.scad_pol), coalesce(f.iniz_gar, f.iniz_pol),
  f.data_copertura, f.data_incasso, f.data_incasso,
  CASE WHEN f.data_incasso IS NULL THEN NULL ELSE f.premio END,
  f.imponibile, f.tasse, f.premio,
  f.imponibile, f.tasse, f.attive, f.attive,
  CASE WHEN f.produttore_id IS NOT NULL AND f.attive <> 0
       THEN round(abs(f.passive / f.attive) * 100, 4) ELSE 0 END,
  f.riparto, f.frazionamento, f.frazionamento, f.rate, 1, f.rinnovo = 'R',
  CASE WHEN f.data_incasso IS NULL THEN NULL ELSE f.tipo_incasso END,
  CASE WHEN f.data_incasso IS NULL THEN NULL ELSE f.conto_incasso END,
  f.tipo_portafoglio, 'EUR', f.cambio, 'CT', f.id_legacy,
  f.comp_contabile, f.comp_assicurativa,
  f.numero_norm, f.numero_riga - 1, 'Quietanza da file Catania 01/10/2026'
FROM figlie f
JOIN LATERAL (
  SELECT t.polizza_id
  FROM public.titoli t
  WHERE regexp_replace(upper(trim(t.numero_titolo)), '[._]+$', '', 'g') = f.numero_norm
    AND t.sostituisce_polizza IS NULL
  ORDER BY t.riga, t.created_at LIMIT 1
) madre ON true;

-- AM con madre presente. Le due AM orfane concordate restano escluse.
WITH am AS (
  SELECT r.*
  FROM tmp_catania_resolved r
  WHERE r.tipo = 'AM'
    AND r.numero_norm NOT IN ('118917057', '118862287')
    AND NOT EXISTS (SELECT 1 FROM public.titoli t WHERE t.id_legacy = r.id_legacy)
),
resolved_am AS (
  SELECT am.*,
         madre.id AS madre_id,
         coalesce(madre.polizza_id, wrapper.polizza_id) AS polizza_id,
         madre.numero_titolo AS madre_numero,
         madre.riga AS madre_riga,
         coalesce(maxr.max_riga, madre.riga, 1) + 1 AS nuova_riga,
         gen_random_uuid() AS new_id
  FROM am
  JOIN LATERAL (
    SELECT t.*
    FROM public.titoli t
    WHERE regexp_replace(upper(trim(t.numero_titolo)), '[._]+$', '', 'g') = am.numero_norm
      AND t.premio_lordo >= 0
    ORDER BY CASE WHEN t.sostituisce_polizza IS NULL THEN 0 ELSE 1 END, t.riga, t.created_at
    LIMIT 1
  ) madre ON true
  LEFT JOIN LATERAL (
    SELECT t.polizza_id
    FROM public.titoli t
    WHERE regexp_replace(upper(trim(t.numero_titolo)), '[._]+$', '', 'g') = am.numero_norm
      AND t.polizza_id IS NOT NULL
    ORDER BY t.riga LIMIT 1
  ) wrapper ON true
  LEFT JOIN LATERAL (
    SELECT max(t.riga) AS max_riga
    FROM public.titoli t
    WHERE regexp_replace(upper(trim(t.numero_titolo)), '[._]+$', '', 'g') = am.numero_norm
  ) maxr ON true
),
inserted_am AS (
  INSERT INTO public.titoli (
    id, numero_titolo, riga, stato, cliente_anagrafica_id,
    compagnia_id, ramo_id, ufficio_id, polizza_id,
    anagrafica_commerciale_id, produttore_nome, specialist, ae_anagrafica_id, ae_nome,
    prodotto_nome, descrizione_polizza, cig_rif,
    durata_da, durata_a, garanzia_da, garanzia_a, data_scadenza, data_competenza,
    data_copertura, data_messa_cassa, data_incasso, importo_incassato,
    premio_netto, tasse, premio_lordo,
    premio_netto_quietanza, tasse_quietanza,
    provvigioni_firma, provvigioni_quietanza,
    percentuale_commerciale, percentuale_riparto,
    frazionamento, periodicita, rate, anni_durata, tacito_rinnovo,
    tipo_incasso, conto_incasso, tipo_portafoglio,
    valuta, cambio, filiale, id_legacy, comp_contabile, comp_assicurativa,
    sostituisce_polizza, sostituisce_riga, appendice,
    is_appendice_modifica, appendice_modifica_polizza_madre_id, note
  )
  SELECT
    a.new_id, a.numero_norm || '/AM' || coalesce(nullif(a.appendice, ''), a.id_legacy::text),
    a.nuova_riga,
    CASE WHEN a.data_incasso IS NULL THEN 'attivo' ELSE 'incassato' END,
    a.cliente_id, a.compagnia_id, a.ramo_id, '${CATANIA_UFFICIO_ID}'::uuid, a.polizza_id,
    a.produttore_id, a.produttore_nome, a.specialist, a.ae_id, a.ae_nome,
    nullif(a.ramo_nome, ''), a.descrizione, a.cig,
    coalesce(a.iniz_pol, a.iniz_gar), coalesce(a.scad_pol, a.scad_gar),
    coalesce(a.iniz_gar, a.iniz_pol), coalesce(a.scad_gar, a.scad_pol),
    coalesce(a.scad_gar, a.scad_pol), coalesce(a.iniz_gar, a.iniz_pol),
    a.data_copertura, a.data_incasso, a.data_incasso,
    CASE WHEN a.data_incasso IS NULL THEN NULL ELSE a.premio END,
    a.imponibile, a.tasse, a.premio, a.imponibile, a.tasse, a.attive, a.attive,
    CASE WHEN a.produttore_id IS NOT NULL AND a.attive <> 0
         THEN round(abs(a.passive / a.attive) * 100, 4) ELSE 0 END,
    a.riparto, a.frazionamento, a.frazionamento, a.rate, 1, a.rinnovo = 'R',
    CASE WHEN a.data_incasso IS NULL THEN NULL ELSE a.tipo_incasso END,
    CASE WHEN a.data_incasso IS NULL THEN NULL ELSE a.conto_incasso END,
    a.tipo_portafoglio, 'EUR', a.cambio, 'CT', a.id_legacy,
    a.comp_contabile, a.comp_assicurativa,
    a.madre_numero, a.madre_riga, a.appendice, true, a.madre_id,
    'Appendice AM import Catania 01/10/2026'
  FROM resolved_am a
  RETURNING id, appendice_modifica_polizza_madre_id, polizza_id, appendice,
            garanzia_da, premio_netto, tasse, premio_lordo, provvigioni_firma,
            descrizione_polizza
)
INSERT INTO public.appendici_polizza (
  titolo_id, polizza_id, numero_appendice, data_appendice, data_effetto,
  oggetto, tipo, note, titolo_modifica_id,
  premio_netto, tasse, premio_lordo, provvigioni, allegati
)
SELECT
  i.appendice_modifica_polizza_madre_id, i.polizza_id,
  coalesce(nullif(i.appendice, ''), 'AM'), i.garanzia_da, i.garanzia_da,
  i.descrizione_polizza, 'modifica', 'Import Catania 01/10/2026', i.id,
  i.premio_netto, i.tasse, i.premio_lordo, i.provvigioni_firma, '[]'::jsonb
FROM inserted_am i;

-- PS: si collega alla riga positiva con stessi importo e periodo.
CREATE TEMP TABLE tmp_catania_ps_inserted (
  storno_id uuid,
  target_id uuid,
  target_polizza_id uuid,
  data_storno date,
  importo numeric,
  has_later_positive boolean
) ON COMMIT DROP;

WITH ps AS (
  SELECT r.*
  FROM tmp_catania_resolved r
  WHERE r.tipo = 'PS'
    AND NOT EXISTS (SELECT 1 FROM public.titoli t WHERE t.id_legacy = r.id_legacy)
),
matched AS (
  SELECT ps.*,
         target.id AS target_id,
         coalesce(target.polizza_id, wrapper.polizza_id) AS target_polizza_id,
         coalesce(maxr.max_riga, 1) + 1 AS nuova_riga,
         gen_random_uuid() AS new_id,
         EXISTS (
           SELECT 1 FROM public.titoli later
           WHERE regexp_replace(upper(trim(later.numero_titolo)), '[._]+$', '', 'g') = ps.numero_norm
             AND later.premio_lordo > 0
             AND later.garanzia_da > coalesce(ps.scad_gar, ps.scad_pol)
         ) AS has_later_positive
  FROM ps
  LEFT JOIN LATERAL (
    SELECT t.*
    FROM public.titoli t
    WHERE regexp_replace(upper(trim(t.numero_titolo)), '[._]+$', '', 'g') = ps.numero_norm
      AND t.premio_lordo >= 0
      AND abs(abs(t.premio_lordo) - abs(ps.premio)) < 0.05
      AND t.garanzia_da = coalesce(ps.iniz_gar, ps.iniz_pol)
      AND t.garanzia_a = coalesce(ps.scad_gar, ps.scad_pol)
    ORDER BY CASE WHEN t.sostituisce_polizza IS NULL THEN 0 ELSE 1 END, t.riga
    LIMIT 1
  ) target ON true
  LEFT JOIN LATERAL (
    SELECT t.polizza_id
    FROM public.titoli t
    WHERE regexp_replace(upper(trim(t.numero_titolo)), '[._]+$', '', 'g') = ps.numero_norm
      AND t.polizza_id IS NOT NULL
    ORDER BY t.riga LIMIT 1
  ) wrapper ON true
  LEFT JOIN LATERAL (
    SELECT max(t.riga) AS max_riga
    FROM public.titoli t
    WHERE regexp_replace(upper(trim(t.numero_titolo)), '[._]+$', '', 'g') = ps.numero_norm
  ) maxr ON true
),
inserted AS (
  INSERT INTO public.titoli (
    id, numero_titolo, riga, stato, cliente_anagrafica_id,
    compagnia_id, ramo_id, ufficio_id, polizza_id,
    anagrafica_commerciale_id, produttore_nome, specialist, ae_anagrafica_id, ae_nome,
    prodotto_nome, descrizione_polizza,
    durata_da, durata_a, garanzia_da, garanzia_a, data_scadenza, data_competenza,
    data_copertura, data_messa_cassa, data_incasso, importo_incassato,
    premio_netto, tasse, premio_lordo,
    premio_netto_quietanza, tasse_quietanza,
    provvigioni_firma, provvigioni_quietanza,
    percentuale_commerciale, percentuale_riparto,
    frazionamento, periodicita, rate, anni_durata,
    tipo_incasso, conto_incasso,
    valuta, cambio, filiale, id_legacy,
    sostituisce_polizza, sostituisce_riga, appendice,
    data_storno, causale_storno, motivo_storno, note
  )
  SELECT
    m.new_id, m.numero_norm, m.nuova_riga, 'annullato',
    m.cliente_id, m.compagnia_id, m.ramo_id, '${CATANIA_UFFICIO_ID}'::uuid, m.target_polizza_id,
    m.produttore_id, m.produttore_nome, m.specialist, m.ae_id, m.ae_nome,
    nullif(m.ramo_nome, ''), m.descrizione,
    coalesce(m.iniz_pol, m.iniz_gar), coalesce(m.scad_pol, m.scad_gar),
    coalesce(m.iniz_gar, m.iniz_pol), coalesce(m.scad_gar, m.scad_pol),
    coalesce(m.scad_gar, m.scad_pol), coalesce(m.iniz_gar, m.iniz_pol),
    m.data_copertura, m.data_incasso, m.data_incasso, m.premio,
    m.imponibile, m.tasse, m.premio, m.imponibile, m.tasse, m.attive, m.attive,
    CASE WHEN m.produttore_id IS NOT NULL AND m.attive <> 0
         THEN round(abs(m.passive / m.attive) * 100, 4) ELSE 0 END,
    m.riparto, m.frazionamento, m.frazionamento, m.rate, 1,
    m.tipo_incasso, m.conto_incasso, 'EUR', m.cambio, 'CT', m.id_legacy,
    m.numero_norm,
    CASE WHEN m.target_id IS NULL THEN NULL ELSE (
      SELECT t.riga FROM public.titoli t WHERE t.id = m.target_id
    ) END,
    coalesce(m.appendice, 'S'), coalesce(m.data_incasso, m.iniz_gar, m.iniz_pol),
    'Annullo amministrativo', 'Storno gestionale PS',
    CASE WHEN m.target_id IS NULL
         THEN 'Storno storico collegato alla polizza; rata positiva storica non presente in CBnet'
         ELSE 'Storno collegato al titolo positivo'
    END
  FROM matched m
  RETURNING id, id_legacy
)
INSERT INTO tmp_catania_ps_inserted
SELECT i.id, m.target_id, m.target_polizza_id,
       coalesce(m.data_incasso, m.iniz_gar, m.iniz_pol), abs(m.premio),
       m.has_later_positive
FROM inserted i
JOIN matched m ON m.id_legacy = i.id_legacy;

INSERT INTO public.titoli_storni
  (titolo_id, titolo_storno_id, polizza_id, data_storno, causale, motivo, importo_rimborsato, era_messa_cassa)
SELECT p.target_id, p.storno_id, p.target_polizza_id, p.data_storno,
       'Annullo amministrativo', 'Storno gestionale PS', p.importo, true
FROM tmp_catania_ps_inserted p
WHERE p.target_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.titoli_storni ts WHERE ts.titolo_storno_id = p.storno_id
  );

UPDATE public.titoli t
SET stato = 'annullato',
    data_storno = coalesce(t.data_storno, p.data_storno),
    causale_storno = coalesce(t.causale_storno, 'Annullo amministrativo'),
    motivo_storno = coalesce(t.motivo_storno, 'Storno gestionale PS'),
    titolo_storno_id = p.storno_id
FROM tmp_catania_ps_inserted p
WHERE t.id = p.target_id
  AND NOT p.has_later_positive;

UPDATE public.polizze pol
SET stato = 'annullata'
FROM tmp_catania_ps_inserted p
WHERE pol.id = p.target_polizza_id
  AND p.target_id IS NOT NULL
  AND NOT p.has_later_positive;

UPDATE public.quietanze q
SET stato = 'annullata'
FROM tmp_catania_ps_inserted p
WHERE q.titolo_id = p.target_id
  AND NOT p.has_later_positive;

ALTER TABLE public.titoli ENABLE TRIGGER trg_genera_quietanze_su_insert_madre;

COMMIT;

SELECT json_build_object(
  'clienti_catania', (
    SELECT count(*) FROM public.clienti
    WHERE ufficio_id = '${CATANIA_UFFICIO_ID}'::uuid
      AND codice_ricerca IN ('017807','017808','017809','017810','017811','017812','017813')
  ),
  'produttori_creati', (
    SELECT count(*) FROM public.anagrafiche_professionali
    WHERE ufficio_id = '${CATANIA_UFFICIO_ID}'::uuid
      AND upper(cognome) IN ('RAPISARDA','PICCOLI','SAGLIMBENE')
      AND attivo IS DISTINCT FROM false
  ),
  'titoli_importati', (
    SELECT count(*) FROM public.titoli WHERE id_legacy IN (
      SELECT id_legacy FROM (VALUES ${rows.map((r) => `(${r.idLegacy})`).join(",")}) ids(id_legacy)
    )
  ),
  'madri_catania', (
    SELECT count(*) FROM public.titoli
    WHERE ufficio_id = '${CATANIA_UFFICIO_ID}'::uuid
      AND id_legacy IN (
        SELECT id_legacy FROM (VALUES ${rows.map((r) => `(${r.idLegacy})`).join(",")}) ids(id_legacy)
      )
      AND sostituisce_polizza IS NULL
      AND NOT coalesce(is_appendice_modifica, false)
  ),
  'senza_cliente', (
    SELECT count(*) FROM public.titoli
    WHERE ufficio_id = '${CATANIA_UFFICIO_ID}'::uuid
      AND id_legacy IN (
        SELECT id_legacy FROM (VALUES ${rows.map((r) => `(${r.idLegacy})`).join(",")}) ids(id_legacy)
      )
      AND cliente_anagrafica_id IS NULL
  )
) AS risultato;
`;
}

const workbook = XLSX.readFile(path.resolve(EXCEL), { cellDates: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json<CataniaPolizzaRiga>(sheet, { defval: null, raw: false });
const rows = rawRows.map(sourceRow);
const groups = groupCataniaPolizze(rawRows);

const report = {
  file: EXCEL,
  rows: rows.length,
  groups: groups.length,
  types: rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.tipo] = (acc[row.tipo] || 0) + 1;
    return acc;
  }, {}),
  promotedPq: groups.filter((group) => group.promossaDaPq).map((group) => group.numero),
  excluded: groups
    .filter((group) => group.escluso)
    .map((group) => ({ numero: group.numero, motivo: group.motivo })),
  companyAliases: [...new Set(rows.filter((row) => row.compagniaRaw !== row.compagnia).map(
    (row) => `${row.compagniaRaw}->${row.compagnia}`,
  ))],
  branchAliases: [...new Set(rows.filter((row) => row.ramoRaw !== row.ramo).map(
    (row) => `${row.ramoRaw}->${row.ramo}`,
  ))],
};

if (rows.length !== 196) throw new Error(`Attese 196 righe, trovate ${rows.length}`);
if (new Set(rows.map((row) => row.idLegacy)).size !== rows.length) {
  throw new Error("ID gestionali duplicati nel file");
}

writeFileSync(PLAN, JSON.stringify(report, null, 2) + "\n");
writeFileSync(OUT, buildSql(rows));
writeFileSync(STAGING_JSON, JSON.stringify(rows.map(stagingJsonRow)) + "\n");
mkdirSync(STAGING_DIR, { recursive: true });
for (let index = 0; index < rows.length; index += 50) {
  const batch = rows.slice(index, index + 50);
  writeFileSync(
    `${STAGING_DIR}/${String(index / 50 + 1).padStart(2, "0")}.sql`,
    `INSERT INTO public._import_catania_polizze_20261001 VALUES\n${batch.map(valueSql).join(",\n")};\n`,
  );
}
console.log(JSON.stringify({
  ...report,
  sql: OUT,
  plan: PLAN,
  staging: STAGING_DIR,
  stagingJson: STAGING_JSON,
}, null, 2));
