## Obiettivo

Allineare il form **Nuovo Account Executive** al form **Nuovo Produttore** (tab Corrispondente in DB): stessi campi, stessa struttura tab, stessi obblighi (Sede opzionale).

## Stato attuale

In `src/pages/AnagraficheInternePage.tsx`:

- **AE** (`isAE`): form ridotto con 3 tab — Dati (Codice, Sigla, Ragione Sociale, Cognome, Nome), RUI & Banca (4 campi RUI + 3 righe banca testuali), Contatti & Note. Sede **obbligatoria**.
- **Produttore** (`isCorr`): form completo con 4 tab — Dati (Codice, Codice Fornitore, Ragione Sociale, Azienda/Cognome, Segue/Nome, Telefono, Fax, Email, blocco RUI), Indirizzo, Provvigioni (% base / consulenza / RA + matrice per Ramo), Banca (ABI, CAB, IBAN, Intestatario). Sede **opzionale**.

## Modifiche

In `src/pages/AnagraficheInternePage.tsx`:

1. **`renderFormFields()`**: unire il branch `isAE` con `isCorr` — quando `isAE || isCorr`, renderizzare lo stesso identico JSX usato oggi per il Produttore (4 tab: Dati / Indirizzo / Provvigioni / Banca, con identici campi e nessun campo marcato `*`).
2. **`renderUfficioSelect()`**: cambiare `const isOptional = isCorr;` in `const isOptional = isCorr || isAE;` così la Sede diventa opzionale anche per AE.
3. **`createMutation`**: nel guard `if (isProduttore && !isCorr && !resolvedUfficioId)` aggiungere `!isAE` per evitare l'errore "Selezionare un ufficio" quando si crea un AE senza Sede.

Nessuna modifica al DB o ad altri file: la tabella `anagrafiche_professionali` già contiene tutte le colonne usate dal form Produttore, e l'AE le condivide.

## Note

- Il tab "Provvigioni per Ramo" (`ProduttoreProvvigioniRamoTab`) verrà mostrato anche per l'AE: usa `anagraficaId={editingId}`, quindi in creazione la matrice resta vuota finché non si salva, esattamente come per il Produttore.
- I dati esistenti AE non vengono toccati; i campi extra ora visibili (es. Codice Fornitore, Indirizzo, Provvigioni, IBAN) erano già editabili lato DB ma nascosti nel form.
