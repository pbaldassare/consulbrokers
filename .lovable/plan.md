## Obiettivo

Sulla pagina **Provvigioni Compagnie/Ramo** (tab del rapporto selezionato) aggiungere la gestione **manuale** dei Rami e Sottorami abilitati per il rapporto, oggi possibile solo dal dialog "Rapporti" della compagnia o tramite Import IA/CSV.

## Stato attuale

- `src/components/compagnie/ProvvigioniRapportiTab.tsx` mostra il banner _"Nessun Ramo abilitato su questo rapporto. Apri 'Rapporti' sulla compagnia e definisci i Rami/Sottorami abilitati."_ quando `compagnia_rapporto_rami` è vuoto.
- L'editor "Rami e Sottorami abilitati" esiste già in `RapportiCompagniaDialog.tsx` (righe ~754–905): grid Ramo + popover sottorami con "Tutti i sottorami" o multiselect.
- I dati vivono in `compagnia_rapporto_rami (compagnia_rapporto_id, gruppo_ramo_id, ramo_id NULL=tutti)`.

## Modifica

1. **Estrarre** l'editor in un componente riusabile `src/components/compagnie/RamiAbilitatiEditor.tsx` che riceve `compagniaRapportoId`, carica/salva su `compagnia_rapporto_rami` (delete + insert come fa già il dialog) e invalida le query `compagnia_rapporto_rami`, `rapporto-rami-abilitati`, `compagnia_rapporto_rami_all`.
2. **Refactor** `RapportiCompagniaDialog.tsx` per usare il nuovo componente (stesso comportamento, nessuna regressione).
3. **Aggiungere in `ProvvigioniRapportiTab.tsx`** una nuova sezione collassabile (sopra "Elenco Rami e provvigioni") intitolata _"Rami e Sottorami abilitati"_ che monta `RamiAbilitatiEditor` per il `rapportoId` corrente. Pulsanti: "Aggiungi Ramo", "Tutti i Rami", "Salva". Salvataggio inline (non serve riaprire il dialog rapporti).
4. **Sostituire il banner vuoto** con un CTA che apre/espande direttamente questa sezione, mantenendo il link al dialog rapporti come secondario.
5. La toolbar esistente (Import IA / Incolla CSV / Copia da altro / Export) resta invariata; questa è la quarta via, completamente manuale.

## Note tecniche

- Nessuna modifica DB.
- Riusare `SearchableSelect`, `useGruppiRamo`, `useRamiAll` (già in `useRamiLookup.ts`).
- Mantenere soft-validation: almeno una riga con `gruppo_ramo_id` valido; `all=true` salva una sola riga con `ramo_id=null`, altrimenti N righe con i `ramo_id` selezionati.
- Toast di conferma + invalidate per far ricomparire la matrice provvigioni con i nuovi rami già pronti da configurare.

## File toccati

- nuovo: `src/components/compagnie/RamiAbilitatiEditor.tsx`
- mod: `src/components/compagnie/RapportiCompagniaDialog.tsx` (sostituire markup inline col componente)
- mod: `src/components/compagnie/ProvvigioniRapportiTab.tsx` (nuova sezione + sostituzione banner vuoto)