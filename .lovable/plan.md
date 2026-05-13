## Cosa modificare in `src/pages/ImmissionePolizzaPage.tsx`

### 1. Compagnia Assicurativa + Agenzia di Riferimento (due campi separati)

Oggi nella sezione **Contratto** c'è un solo campo "Agenzia / Agenzia di rif." che mostra `compagnie` (di fatto le agenzie). Il pattern corretto a 2 livelli **esiste già** in `src/components/polizze/ImportNuovaPolizzaAIDialog.tsx` (Gruppo Compagnia → Agenzia) e usa le tabelle `gruppi_compagnia` e `compagnie.gruppo_compagnia_id`.

Lo replico in `ImmissionePolizzaPage`:

- Aggiungo stato `selectedGruppoCompagniaId` e caricamento di `gruppi_compagnia` (id, nome) tramite query React Query.
- Sostituisco il blocco "Agenzia / Agenzia di rif." con due `SearchableSelect` affiancati (`col-span-1` ciascuno):
  - **Compagnia Assicurativa** → opzioni da `gruppi_compagnia`. Al cambio resetta `selectedCompagnia` se non appartiene al gruppo.
  - **Agenzia di Riferimento** → opzioni da `compagnieList` filtrate per `gruppo_compagnia_id === selectedGruppoCompagniaId`; disabilitato finché non è scelta la compagnia. Se l'utente non sceglie il gruppo, mostra comunque tutte (fallback) per non bloccare flussi legacy.
- Auto-selezione: se viene scelta un'agenzia, popolo automaticamente `selectedGruppoCompagniaId` dal suo `gruppo_compagnia_id` (coerenza con l'AI dialog).
- Salvataggio: nessun cambio schema. Continuiamo a persistere solo `compagnia_id` su `titoli` (il gruppo è derivabile via join). `gruppi_compagnia` è solo lookup UI.

### 2. Visibilità testo Ramo / Sottoramo

Nello screenshot i due `SearchableSelect` di `RamoSottoramoSelect` mostrano testo troncato ("Seleziona r…", "Tutti i sottorami"). Il container li mette in `col-span-2` su una griglia a 4 colonne, quindi ognuno occupa ~150px.

Soluzioni (file `src/components/polizze/RamoSottoramoSelect.tsx` o wrapper in `ImmissionePolizzaPage`):
- Allargo il blocco Ramo/Sottoramo a `col-span-4` (riga propria) così entrambi i select hanno spazio sufficiente, mantenendo il layout 50/50 interno.
- In aggiunta verifico/forzo `min-w-0` + `truncate` sull'elemento di rendering del valore selezionato del `SearchableSelect` per evitare ellissi su label cortissime.

Risultato: Compagnia + Agenzia su una riga, Ramo + Sottoramo su una riga sotto (entrambi pienamente leggibili), poi Prodotto.

### Out of scope
- Nessuna modifica DB.
- Nessuna modifica al flusso AI Import (già a posto) né al salvataggio backend.
- Nessuna modifica alle altre pagine (TitoloDetail, Trattative) — possono essere allineate in un secondo momento se richiesto.
