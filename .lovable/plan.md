

## Piano: Aggiornamento Tabelle di Base con dati reali

### 1. Tabella `tipi_mandatario` — Sostituzione completa

**Stato attuale**: 6 record generici (AGE, BRO, DEL, DIR, MAN, SUB)
**Dati Excel**: 14 record con codici numerici specifici del settore assicurativo

| Codice | Descrizione |
|--------|-------------|
| 01 | Direzione |
| 02 | Gerenza |
| 03 | Agenzia Generale |
| 04 | Agente Monomandatario |
| 11 | Agente Multimandatario |
| 12 | Broker |
| 13 | Sub-Agente |
| 21 | Compagnia Estera |
| 22 | Agente Estero |
| 23 | Broker Estero |
| 31 | Lloyd's Coverholder |
| 32 | Lloyd's Broker |
| 33 | Lloyd's Service Company |
| 99 | Altro |

**Azione**: Cancellare i 6 record esistenti e inserire i 14 nuovi. Verificare prima che nessun titolo faccia riferimento ai vecchi codici.

### 2. Tabella `lookup_tipo_documento` — Sostituzione completa

**Stato attuale**: 3 record (PI, PQ, AM) — questi sono tipi di movimento polizza, non tipi documento completi.
**Dati Excel**: 91 tipi documento con struttura gerarchica e colonne aggiuntive.

L'Excel ha molte più colonne rispetto alla struttura semplice `codice/descrizione/attivo` della lookup:
- `Visibile`, `Clienti`, `Compagnie`, `Polizze`, `Trattative`, `Contrattuali`, `Prod`
- `Firma`, `Firma Avanzata`, `Smart Anchors`, `Box firma 1-4`, `Clausole Particolari`, `Pos Clausole`

**Problema**: La tabella `lookup_tipo_documento` ha solo `codice, descrizione, attivo`. I dati Excel hanno una struttura molto più ricca (visibilità per sezione, firma elettronica, ecc.).

**Proposta**: Serve ampliare la tabella `lookup_tipo_documento` con le colonne aggiuntive per gestire correttamente la classificazione documentale. In alternativa, creare una nuova tabella dedicata `tipi_documento_polizza` con tutte le colonne.

### Domanda prima di procedere

Per i **tipi documento**: l'Excel ha 19 colonne con flag di visibilità (Clienti, Compagnie, Polizze, Trattative, ecc.) e gestione firma elettronica. Devo:

**A)** Aggiungere tutte queste colonne alla tabella `lookup_tipo_documento` esistente (e aggiornare la UI in TabelleBasePage con un form più complesso)

**B)** Creare una nuova tabella `tipi_documento` separata con tutte le colonne, lasciando `lookup_tipo_documento` solo per i 3 tipi movimento (PI/PQ/AM)

### Dettagli tecnici

**File coinvolti:**

| File | Modifica |
|------|----------|
| Migrazione SQL | ALTER TABLE o CREATE TABLE per colonne aggiuntive |
| `src/pages/TabelleBasePage.tsx` | Tab custom per gestire i nuovi campi |
| Dati | INSERT dei record da Excel |

