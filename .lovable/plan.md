# Reset agenzie/broker e ricostruzione form

## Obiettivo
Cancellare tutti i 476 record `compagnie` con `tipo IN ('agenzia','broker')` e rifare la form di inserimento pulita, con i campi davvero utili. Le **106 compagnie assicurative madri** (`gruppi_compagnia`) restano intatte.

---

## Fase 1 — Backup (sicurezza)

Snapshot completo su `_backup_compagnie_reset_20260516` (admin-only) con tutte le colonne + JSON di `compagnia_rapporti` collegati. Recuperabile in lettura.

## Fase 2 — Azzeramento riferimenti (SET NULL manuale)

Le FK su `compagnie.id` sono quasi tutte `ON DELETE NO ACTION`. Prima del DELETE devo svuotare a mano:

| Tabella | Colonna | Azione |
|---|---|---|
| `titoli` | `compagnia_id` | UPDATE → NULL |
| `sinistri` | `compagnia_id` | UPDATE → NULL |
| `trattative` | `compagnia_id` | UPDATE → NULL |
| `prodotti` | `compagnia_id` | UPDATE → NULL |
| `flussi_compagnia` | `compagnia_id` | UPDATE → NULL |
| `anagrafiche_professionali` | `compagnia_id` | UPDATE → NULL |
| `dettaglio_riparto` | `compagnia_id` | UPDATE → NULL |
| `rimessa_premi` | `compagnia_id` | UPDATE → NULL |
| `document_folders` | `compagnia_id` | già SET NULL automatico |
| `compagnia_rapporti` | `compagnia_id` | CASCADE automatico (si cancella) |
| `provvigioni_compagnia_ramo` | `compagnia_id` | CASCADE automatico |

Solo per i record dove `compagnia_id` punta a un'agenzia/broker (NON tocco i riferimenti alle compagnie madri).

## Fase 3 — DELETE

```sql
DELETE FROM compagnie WHERE tipo IN ('agenzia','broker');
```
Risultato atteso: 0 record `agenzia`/`broker` rimasti.

## Fase 4 — Pulizia schema (rimozione campi inutili nella form)

Confermami i campi della nuova form. **Proposta minimale** (campi che propongo di tenere visibili; quelli legacy restano in DB ma nascosti):

**Essenziali (obbligatori)**
- `codice` ★ obbligatorio + unique
- `nome` (Ragione sociale)
- `tipo` (agenzia / broker / direzione)
- `gruppo_compagnia_id` (compagnia madre, opzionale per broker)

**Anagrafica**
- `partita_iva`, `codice_fiscale`
- `indirizzo`, `cap`, `comune` (con autocomplete)
- `telefono`, `mail`, `pec`

**Operativi**
- `iscrizione_rui_sez`, `iscrizione_rui_num`
- `iban`, `intestato_a` (o `conto_bancario_id`)
- `stato` (Attivo / Sospeso)

**Da rimuovere dalla UI** (residui legacy, restano in DB ma nascosti):
- `provincia` (deriva da `comune`)
- `fax`, `cellulare`, `mail_avvisi`, `nome_segue`, `nome_sede`
- `codice_abi`, `codice_cab`, `bic`, `citta_banca` (sostituiti da IBAN)
- `gruppo_compagnia` (testo legacy, sostituito da `gruppo_compagnia_id`)
- `tipo_copertura`, `aut_incasso_118`, `ra_ec_negativi`, `allegato_excel_*`, `escluso_all4`, `pagamento`, `tipo_pagamento`
- `percentuale_ra`, `ultima_scadenza_polizza`, `gruppo_statistico`, `tipo_mandatario`, `firma_digitale`

→ Se confermi questi tagli aggiungo `codice` UNIQUE constraint e nascondo i campi dalla form di `CompagnieList.tsx`.

## Fase 5 — UI nuova form

In `src/pages/CompagnieList.tsx`, tab "Agenzie":
- Form a sezioni: **Identificativi · Anagrafica · Contatti · RUI · Bancario**
- Validazioni: `codice` univoco (case-insensitive), P.IVA 11 cifre, IBAN valido (helper esistente)
- Tab "Agenzie" mostra colonne: **Codice · Nome · Tipo · Compagnia madre · Comune · Stato · Rapporti**
- Rimosse colonne: Provincia, Agenzia, Sede
- Filtro per tipo (agenzia / broker / direzione)
- Bottone "Nuova Agenzia" con `tipo` preselezionato dal filtro

## Fase 6 — Memoria

Aggiorno `mem://insurance/compagnie-struttura-pulita` con: campi obbligatori, campi nascosti, regole codice univoco.

---

## Cosa NON tocco
- 106 compagnie assicurative madri (`gruppi_compagnia`)
- Storico titoli/sinistri/trattative (restano con `compagnia_id = NULL`, poi riassocerete)
- Tabella `compagnie` come schema (solo aggiungo UNIQUE su `codice`)

## Conferme richieste prima di eseguire
1. **Lista campi** della Fase 4 ti va bene? Vuoi aggiungere/togliere qualcosa?
2. **`codice` UNIQUE**: ok renderlo obbligatorio e univoco?
3. Procedo con tutto in un'unica migrazione (backup + SET NULL + DELETE) e poi modifico la UI in un secondo step?
