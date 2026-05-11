---
name: Garanzie RCA collegate al Gruppo Ramo
description: rca_garanzie.gruppo_ramo_id (NOT NULL) collega ogni garanzia a un gruppo_ramo; UI polizza filtra per gruppo del ramo del titolo
type: feature
---

`rca_garanzie.gruppo_ramo_id` (uuid NOT NULL → `gruppi_ramo.id` ON DELETE RESTRICT) collega ogni garanzia accessoria RCA a un gruppo ramo. Tutte le 18 garanzie esistenti sono assegnate al gruppo `ZQ - R.C.A.`.

**UI Tabelle di Base** (`TabelleBasePage.tsx` → `RcaGaranzieTab`): editor mostra `SearchableSelect` "Gruppo Ramo" obbligatorio (default ZQ) e colonna gruppo nella tabella.

**Polizze** (`VociRcaCard.tsx`): query `useQuery(["titolo-gruppo-ramo", titoloId])` deriva `gruppo_ramo_id` via join `titoli.ramo_id → rami.gruppo_ramo_id`. Il catalogo `rca_garanzie` viene filtrato `.eq('gruppo_ramo_id', gruppoRamoTitolo)`, quindi il dropdown mostra solo garanzie pertinenti al gruppo del ramo della polizza.

Mapping AI (`mapGaranzieRca.ts`) e tabella `premi_garanzia_polizza` non toccati: continuano a usare `codice_garanzia` testuale.
