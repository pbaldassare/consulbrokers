---
name: Gruppi Finanziari - Tipo Soggetto
description: Il flag tipo_soggetto su gruppi_finanziari (privato/azienda/ente) governa dinamicamente i campi anagrafica cliente; tipo_cliente è derivato automaticamente.
type: feature
---

## Schema
- `gruppi_finanziari.tipo_soggetto` text CHECK IN ('privato','azienda','ente')
- `clienti.codice_cup` text (nullable a DB, obbligatorio lato form solo per ENTE)

## Derivazione automatica
Quando si seleziona un Gruppo Finanziario su un cliente, `clienti.tipo_cliente` viene automaticamente derivato dal `tipo_soggetto` del gruppo. Il campo non è modificabile separatamente.

## Campi per tipologia (ClienteDetail.tsx)
- **PRIVATO**: nome, cognome, CF (16 char, validato e con auto-fill di sesso/data/luogo nascita via `parseCF`), data/luogo nascita, indirizzo residenza.
- **AZIENDA**: ragione sociale, P.IVA, CF azienda (11 cifre → auto copia in P.IVA), forma giuridica, SDI, indirizzo sede.
- **ENTE**: come azienda + **Codice CUP obbligatorio**.

## Clienti esistenti
Nessuna modifica retroattiva ai dati. Le nuove regole si applicano solo a inserimenti/modifiche manuali.
