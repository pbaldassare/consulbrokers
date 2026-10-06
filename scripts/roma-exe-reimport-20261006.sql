-- Reimport portafoglio ROMA 2 EXE (ufficio RM2) — eseguito a mano dall'SQL Editor il 05-06/10/2026.
-- Sorgente: elenco_polizze_05.03.2026.xlsx (4.140 righe) + Estrazione_polizze_auto (rischi auto).
--
-- Regole applicate:
-- * Polizza (riga 1) = rata già incassata nel gestionale EXE: stato 'incassato', data cassa presunta
--   = inizio della rata, sempre prima del go-live (01/09/2026), quindi fuori dagli E/C agenzie.
-- * Quietanza (riga 2) = prima rata con scadenza >= 01/09/2026, stato 'attivo' (da incassare in CBnet).
--   Le rate successive le genera il trigger genera_quietanza_su_messa_cassa all'incasso.
-- * Una tantum: solo polizza. Premio zero (netto+tasse = 0): saltate. 31 righe senza cliente/compagnia: saltate.
-- * Importi rata = "Importo imponibile future" + "Importo tasse future" del file; provvigioni attive sulla rata.
-- * Sottoramo: default per ramo EXE (vedi roma_exe_rischi_map) + incrocio con il file auto per cliente+compagnia.
-- * Cliente, compagnia e numero polizza riusati dal vecchio import (bak_rm2_20261005_*).
--
-- Tabelle di appoggio create: roma_exe_import_stage (353 importi), roma_exe_import_sottorami (553 auto),
-- roma_exe_import_plan (piano 3.747 polizze / 3.741 quietanze). Backup cancellazione: bak_rm2_20261005_*.
-- Il piano è stato costruito via MCP (vedi sessione); qui sotto gli statement eseguiti dall'utente.

-- ---------------------------------------------------------------------------
-- STEP 1 — rapporti compagnia mancanti e assegnazione nel piano
-- ---------------------------------------------------------------------------
begin;

insert into public.gruppi_compagnia (codice, descrizione)
select v.codice, v.descrizione from (values
  ('AFI',  'AFI ESCA IARD'),
  ('TUA',  'TUA ASSICURAZIONI SPA'),
  ('CGPA', 'CGPA EUROPE S.A.'),
  ('ACC',  'ACCELERANT'),
  ('GAMA', 'GAMALIFE - COMPANHIA DE SEGUROS DE VIDA SA')
) as v(codice, descrizione)
where not exists (select 1 from public.gruppi_compagnia g where upper(trim(g.descrizione)) = upper(trim(v.descrizione)))
  and not exists (select 1 from public.gruppi_compagnia g where g.codice = v.codice);

insert into public.compagnia_rapporti (
  compagnia_id, gruppo_compagnia_id, tipo_rapporto, nome_rapporto, codice_rapporto,
  iban_dedicato, sede_denominazione, sede_indirizzo, sede_cap, sede_citta, sede_provincia,
  attivo, is_principale, conto_bancario_id, note)
select c.id, coalesce(c.gruppo_compagnia_id, g.id),
  case when c.tipo = 'direzione' then 'Direzione' else 'Mandato diretto' end,
  c.nome, c.codice, c.iban, c.nome_sede, c.indirizzo, c.cap, c.comune, c.provincia,
  coalesce(c.attiva, true), (c.gruppo_compagnia_id is not null), c.conto_bancario_id,
  'Rapporto creato con import portafoglio ROMA 2 EXE del 06/10/2026'
from public.compagnie c
left join public.gruppi_compagnia g on upper(trim(g.descrizione)) = upper(trim(c.nome))
where c.codice in ('RM20529','RM20393','RM20696','RM20514','RM20549','RM20726','RM20688','RM20618','RM20734','RM20680','RM20724')
  and not exists (select 1 from public.compagnia_rapporti r where r.compagnia_id = c.id);

update public.roma_exe_import_plan p
   set compagnia_rapporto_id = r.id
  from public.compagnia_rapporti r
 where p.compagnia_rapporto_id is null
   and r.compagnia_id = p.compagnia_id
   and (select count(*) from public.compagnia_rapporti r2 where r2.compagnia_id = p.compagnia_id) = 1;

update public.roma_exe_import_plan p
   set compagnia_rapporto_id = 'a510600b-4045-443f-8487-f8a47bd49236'
 where p.compagnia_rapporto_id is null
   and p.compagnia_id = (select compagnia_id from public.compagnia_rapporti where id = 'a510600b-4045-443f-8487-f8a47bd49236');

commit;

-- ---------------------------------------------------------------------------
-- STEP 2 — inserimento titoli (idempotente: salta le righe già presenti)
-- ---------------------------------------------------------------------------
begin;

insert into public.titoli (
  id, numero_titolo, riga, stato, cliente_anagrafica_id, compagnia_id, compagnia_rapporto_id, ramo_id, ufficio_id,
  garanzia_da, garanzia_a, durata_da, durata_a, data_scadenza, data_competenza,
  premio_netto, tasse, premio_lordo, premio_netto_quietanza, tasse_quietanza, provvigioni_firma, provvigioni_quietanza,
  frazionamento, periodicita, percentuale_riparto, coassicurazione, emittenda,
  data_messa_cassa, data_incasso, data_copertura, importo_incassato,
  note, descrizione_polizza, prodotto_nome, valuta, tacito_rinnovo, anni_durata, specialist, tipo_portafoglio)
select p.polizza_titolo_id, p.numero_titolo, 1, 'incassato', p.cliente_anagrafica_id, p.compagnia_id, p.compagnia_rapporto_id, p.ramo_id, 'c83a748c-653f-4cbd-b075-b399eccdd1b1'::uuid,
  p.pda, p.pa, p.eff, greatest(p.scad, p.pa), greatest(p.scad, p.pa), p.pda,
  p.imp, p.tax, p.imp + p.tax, p.imp, p.tax, p.provv, p.provv,
  p.fraz, p.fraz, p.quota, (p.quota < 99.99), p.emittenda,
  p.pda, p.pda, p.pda, p.imp + p.tax,
  concat_ws(E'\n', nullif(p.bnote,''), case when p.staged then 'Importi rata dal file elenco_polizze_05.03.2026' end,
    'Import EXE 06/10/2026: polizza = rata già incassata nel gestionale EXE (data cassa presunta ' || to_char(p.pda,'DD/MM/YYYY') || ')'
    || case when p.qda is not null then '; rata successiva creata come quietanza riga 2' else '' end),
  p.prodotto_nome, p.prodotto_nome, 'EUR', false, 1, 'ROMA EXE', 'PORTAFOGLIO PREESISTENTE'
from public.roma_exe_import_plan p
where not exists (select 1 from public.titoli t where t.id = p.polizza_titolo_id);

insert into public.titoli (
  id, numero_titolo, riga, stato, cliente_anagrafica_id, compagnia_id, compagnia_rapporto_id, ramo_id, ufficio_id,
  garanzia_da, garanzia_a, durata_da, durata_a, data_scadenza, data_competenza,
  premio_netto, tasse, premio_lordo, premio_netto_quietanza, tasse_quietanza, provvigioni_firma, provvigioni_quietanza,
  frazionamento, periodicita, percentuale_riparto, coassicurazione, emittenda,
  sostituisce_polizza, sostituisce_riga,
  note, descrizione_polizza, prodotto_nome, valuta, tacito_rinnovo, anni_durata, specialist, tipo_portafoglio)
select p.quietanza_titolo_id, p.numero_titolo, 2, 'attivo', p.cliente_anagrafica_id, p.compagnia_id, p.compagnia_rapporto_id, p.ramo_id, 'c83a748c-653f-4cbd-b075-b399eccdd1b1'::uuid,
  p.qda, p.qa, p.qda, p.qa, p.qa, p.qda,
  p.imp, p.tax, p.imp + p.tax, p.imp, p.tax, p.provv, p.provv,
  p.fraz, p.fraz, p.quota, (p.quota < 99.99), p.emittenda,
  p.numero_titolo, 1,
  'Import EXE 06/10/2026: rata da incassare in CBnet (periodo ' || to_char(p.qda,'DD/MM/YYYY') || ' - ' || to_char(p.qa,'DD/MM/YYYY') || ')',
  p.prodotto_nome, p.prodotto_nome, 'EUR', false, 1, 'ROMA EXE', 'PORTAFOGLIO PREESISTENTE'
from public.roma_exe_import_plan p
where p.quietanza_titolo_id is not null
  and not exists (select 1 from public.titoli t where t.id = p.quietanza_titolo_id);

insert into public.roma_exe_polizze_map (exe_chiave, exe_numero, exe_tipo, titolo_id, esito, motivo)
select 'elenco:' || p.seq, p.numero_titolo, 'polizza', p.polizza_titolo_id, 'creata', 'Import 06/10/2026 - polizza (rata incassata in EXE)'
from public.roma_exe_import_plan p
union all
select 'elenco:' || p.seq || ':q2', p.numero_titolo, 'quietanza', p.quietanza_titolo_id, 'creata', 'Import 06/10/2026 - rata da incassare'
from public.roma_exe_import_plan p where p.quietanza_titolo_id is not null
on conflict (exe_chiave) do nothing;

commit;

-- Esito verificato il 06/10/2026: 3.747 polizze incassate (lordo 7.593.258,81),
-- 3.741 quietanze da incassare (lordo 7.571.863,68), 0 incoerenze.

-- ---------------------------------------------------------------------------
-- STEP 3 (06/10/2026) — composizione premio per garanzia + pulizia appoggio
-- ---------------------------------------------------------------------------
-- Per ogni titolo importato: una riga premi_garanzia_polizza tipo 'firma' con il sottoramo come voce,
-- firma = premio_netto, aliquota_tasse_pct = tasse/netto, tasse_rettifica per quadrare al centesimo;
-- la riga 'quietanza' la crea il trigger premi_garanzia_sync_quietanza. Poi drop di
-- roma_exe_import_stage e roma_exe_import_sottorami (roma_exe_import_plan e bak_rm2_* restano).
-- Esito: 7.489 voci firma / 7.489 quietanza, 0 differenze.

-- ---------------------------------------------------------------------------
-- STEP 4 (06/10/2026) — produttori EXE (file Produttori_al_05.03.2026.xlsx, 32 codici)
-- ---------------------------------------------------------------------------
-- Categoria usata: anagrafiche_professionali tipo 'corrispondente' (= tendina "Produttore"),
-- ufficio RM2, codice 'EXE-<codice EXE>', percentuale_base = quota prevalente del produttore.
-- 30 schede create; DBB riusa la scheda esistente 40d9da90-...; Di Falco unica per i codici 28 e 128.
-- Collegamento su titoli (polizza riga 1 e quietanza riga 2): anagrafica_commerciale_id,
-- produttore_nome, percentuale_commerciale = provvigioni passive / attive della singola polizza
-- (0% per i 16 produttori senza provvigioni passive nel file). Secondo produttore (10 polizze) in nota.
-- Esito: 1.620 polizze e 1.616 quietanze collegate, 28 produttori usati.
