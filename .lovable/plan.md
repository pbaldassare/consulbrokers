# Collegamento Garanzie RCA ↔ Gruppi Ramo

## Stato attuale
- `gruppi_ramo` (12) ← `rami` (198, via `gruppo_ramo_id`) ✅ già collegati
- `rca_garanzie` (18) → **scollegata** da rami / gruppi_ramo ❌

## Obiettivo
Le 18 garanzie RCA devono appartenere al gruppo ramo `ZQ - R.C.A.`. In fase polizza, il dropdown Garanzie RCA mostrerà solo quelle del gruppo del ramo della polizza corrente.

## Modifiche

### 1. Database (migrazione)
- Aggiungi colonna `rca_garanzie.gruppo_ramo_id uuid REFERENCES gruppi_ramo(id) ON DELETE RESTRICT`
- Indice su `gruppo_ramo_id`
- Backfill: tutte le 18 righe esistenti → id del gruppo `ZQ`
- Set `NOT NULL` dopo backfill
- RLS: invariata (lettura authenticated, scrittura staff già esistenti)

### 2. UI Tabelle di Base (`src/pages/TabelleBasePage.tsx`)
- Custom editor `rca_garanzie`: aggiungi `SearchableSelect` "Gruppo Ramo" (default ZQ) accanto a Codice/Descrizione/Aliquota
- Colonna tabella: mostra il codice gruppo accanto alla descrizione
- Insert/Update payload include `gruppo_ramo_id`

### 3. Lookup polizza (`src/components/polizze/VociRcaCard.tsx`)
- Query `rca_garanzie`: filtra `.eq('gruppo_ramo_id', gruppoRamoIdDelRamoCorrente)` ricavato dal `ramo` del titolo (join `rami → gruppo_ramo_id`)
- Se nessun gruppo collegato (ramo non auto), il pulsante "Voce da catalogo" resta nascosto come oggi

### 4. Memoria
Salvo nuovo file `mem://insurance/garanzie-rca-gruppo-ramo` e aggiorno l'indice.

## Note tecniche
- Nessuna rottura di dati: backfill completo prima di NOT NULL
- `mapGaranzieRca.ts` (mapping AI) resta invariato: usa codice garanzia
- `premi_garanzia_polizza` non viene toccata (riferisce `codice_garanzia` testuale)
