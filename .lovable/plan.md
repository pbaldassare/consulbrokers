## Obiettivo

Quando in **Immissione Polizza** si seleziona un sottoramo RCA principale (es. `QA — R.C. AUTO`, `PI`, `RV01…RV16`, `QN/QT/QNA`, `DD/DN/DNA`, ecc.), la riga di Premio per Garanzia deve mostrare e raccogliere anche **IPT** (imposta provinciale) e **SSN** (10,5%), come già avviene nelle card `VociRcaCard` di `TitoloDetail`. Oggi in Immissione la riga ha solo Netto / Aliquota / Tasse / Lordo: l'utente non può inserire SSN.

## Riferimento già esistente

- `src/components/polizze/VociRcaCard.tsx` (post-creazione) → calcola: `imposta = netto × aliquota_provinciale%`, `ssn = netto × 10,5%`, `lordo = netto + imposta + ssn`. Override editabili. Memoria: `mem://insurance/rca-voci-composizione-premio`.
- Tabella `aliquote_provinciali_rca` per provincia cliente.
- DB `premi_garanzia_polizza` ha già le colonne `imposta_provinciale`, `ssn`, `is_rca_principale`, `aliquota_tasse_pct`.

## Modifiche

### 1. `src/components/polizze/PremiGaranziaCardShell.tsx`

- Estendere `GaranziaRow` con: `isRcaPrincipale?: boolean`, `imposta?: string`, `ssn?: string`, `aliquotaProvinciale?: number`.
- Nuove props del componente: `provinciaCliente?: string | null`, `useAutoTaxFormula?: boolean` (default `false`; `true` per gruppi ramo auto/nautica).
- Quando `useAutoTaxFormula` è `true`:
  - Caricare `aliquota_pct` da `aliquote_provinciali_rca` per `provinciaCliente` (default 16).
  - In `handleGaranziaSelect`, marcare automaticamente `isRcaPrincipale = true` se il `codice` del sottoramo è nel set principali (`PI, QA, QAC, QC, QF, QG, QR, QU, DAB, PJ, RV01..RV16, QN, QT, QNA, DD, DN, DNA`). Stesso set di `VociRcaCard`.
  - Per le righe `isRcaPrincipale`:
    - Sostituire la cella "Aliquota %" con due input compatti **IPT €** e **SSN €** (e mostrare l'aliquota provinciale come hint accanto a IPT, es. `(16,00%)`).
    - Auto-calcolo: digitando il netto → `imposta = netto × aliqProv%`, `ssn = netto × 10,5%`, `lordo = netto + imposta + ssn`.
    - Editing manuale di IPT o SSN → mantiene l'override (badge "Personalizzato" sull'header se c'è override > 0,01 €).
    - Editing del Lordo per riga RCA → inverso: `factor = 1 + aliqProv/100 + 10,5/100`, `netto = lordo / factor`, reset override.
    - La cella Tasse € della riga RCA mostra `imposta + ssn` (read-only somma).
  - Per righe non principali: comportamento attuale (lordo = netto × (1 + aliquota/100)).
- I totali Netto / Tasse / Lordo continuano a sommare correttamente (nessuna logica nuova: la riga RCA contribuisce con i suoi `netto + imposta + ssn`).

### 2. `src/pages/ImmissionePolizzaPage.tsx`

- Calcolare `useAutoTaxFormula` da `selectedGruppoRamoId` (lookup `gruppi_ramo.codice` già caricato): `true` se gruppo è `ZQ` (R.C.A.) oppure gruppo nautica (`Z?` per natanti, riusare la stessa lista di rami in `VociRcaCard`).
- Recuperare `provinciaCliente` da `clienteDetail` (campo già caricato nella query `cliente-dettaglio-immissione`).
- Passare `provinciaCliente` e `useAutoTaxFormula` a entrambe le card `PremiGaranziaCardShell` (Firma + Quietanza).
- Nel salvataggio in `premi_garanzia_polizza` (riga ~880), per ogni `r` aggiungere:
  - `is_rca_principale: r.isRcaPrincipale === true`
  - `imposta_provinciale: r.isRcaPrincipale ? Number(r.imposta) || 0 : null`
  - `ssn: r.isRcaPrincipale ? Number(r.ssn) || 0 : null`
  - `aliquota_tasse_pct: r.isRcaPrincipale ? aliquotaProvinciale : r.aliquotaTasse`

### 3. Memoria

- Aggiornare `mem://insurance/rca-voci-composizione-premio` aggiungendo nota: «In Immissione Polizza la stessa logica IPT+SSN è gestita da `PremiGaranziaCardShell` quando `useAutoTaxFormula=true` e provincia cliente disponibile.»

## Fuori scope

- Nessuna migrazione DB (colonne già esistono).
- Nessuna modifica a Rinnovo/Duplicazione/Sospensione (creano titoli copiando, e la card post-creazione `VociRcaCard` già gestisce il flusso).
- Nessun cambio a `VociRcaCard`.

## Verifica

- Selezionando `QA — R.C. AUTO` in Immissione: la riga deve mostrare IPT e SSN, calcolati dal netto (16% e 10,5% di default).
- Override IPT/SSN persistente fino al cambio netto manuale.
- Salvando il titolo, riaprendolo da `TitoloDetail` la card Firma deve riflettere gli stessi valori senza ricalcoli sorprendenti.
