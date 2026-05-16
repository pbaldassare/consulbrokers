---
name: Compagnie form pulita (post-reset 16/05/2026)
description: Nuova struttura form Agenzia/Broker/Direzione dopo il reset totale; campi essenziali, codice univoco
type: feature
---

## Reset del 16/05/2026
Tutte le 476 agenzie/broker sono state cancellate (backup in `_backup_compagnie_reset_20260516`, admin-only).
Le 106 compagnie madri (`gruppi_compagnia`) sono rimaste intatte.
Storico titoli/sinistri/trattative ha `compagnia_id = NULL` per i record che puntavano alle agenzie cancellate.

## Campi obbligatori (UI)
- `tipo` (agenzia / broker / direzione) — radio
- `codice` — UNIQUE case-insensitive (`idx_compagnie_codice_unique`), uppercase auto
- `nome` (Ragione sociale)
- `gruppo_compagnia_id` (Compagnia madre) — obbligatorio per `agenzia`/`direzione`, opzionale per `broker`

## Campi visibili
- **Identificativi**: tipo, codice, stato (Attivo/Sospeso), nome, compagnia madre
- **Anagrafica**: CF, P.IVA, indirizzo (autocomplete), CAP, comune, nazione, mail, PEC, telefono, mail EC, note
- **RUI & Bancario**: sezione+numero RUI, conto bancario (registro), IBAN alternativo, intestato a
- **Provvigioni**: tab esistente per provvigioni_compagnia_ramo

## Campi nascosti dalla UI (restano in DB legacy)
provincia (derivata da comune), fax, cellulare, mail_avvisi, nome_segue, nome_sede,
codice_abi, codice_cab, bic, citta_banca (sostituiti da IBAN),
gruppo_compagnia (text legacy, usato solo `gruppo_compagnia_id`),
pagamento, tipo_pagamento, percentuale_ra, gruppo_statistico, tipo_mandatario,
tipo_copertura, aut_incasso_118, ra_ec_negativi, allegato_excel_*, escluso_all4, firma_digitale.

## Tabella elenco
Colonne: Codice · Ragione sociale · Tipo (badge) · Compagnia madre · Comune · Stato · Rapporti · Attiva · Az.
Filtro per `tipo` (agenzia/broker/direzione/tutti).
File: `src/pages/CompagnieList.tsx`.
