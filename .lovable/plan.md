## Obiettivo
Unificare l'apertura sinistro: il bottone **"Nuovo Sinistro"** in `/sinistri` deve usare lo stesso flusso (stesso schema, stessi step, stessi campi, stessa UX) della pagina **"Apertura Sinistro"** (`/sinistri/apertura`, `SinistroAperturaWizardPage`), che oggi è più ricca e completa.

## Stato attuale
- `SinistriList.tsx` → bottone "Nuovo Sinistro" apre un **Dialog inline** con un mini-wizard custom (form ridotto, campi diversi, niente bozza, niente conferma annullamento).
- `SinistroAperturaWizardPage.tsx` → wizard completo con `react-hook-form` + zod, draft persistente, step multipli, priorità, riserva, ecc. Raggiungibile da menu / link diretto a `/sinistri/apertura`.

Risultato: due esperienze divergenti per la stessa azione.

## Approccio proposto
Eliminare il mini-wizard inline e far sì che "Nuovo Sinistro" porti all'unico wizard ufficiale.

1. In `src/pages/SinistriList.tsx`:
   - Rimuovere l'intero blocco `Dialog` del nuovo sinistro e tutto lo stato wizard correlato (`dialogOpen`, step state, handler `resetDialog`, submit, ricerca polizza inline, ecc.).
   - Rimuovere gli import non più usati (`Dialog*`, eventuali hook/zod schema locali, icone non più referenziate).
   - Sostituire il bottone con un semplice `Button` che fa `navigate("/sinistri/apertura")` (usando `useNavigate` di `react-router-dom`, già presumibilmente disponibile o da importare).
   - Mantenere etichetta "Nuovo Sinistro" e icona `Plus` per non cambiare la UI percepita.

2. Nessuna modifica a `SinistroAperturaWizardPage.tsx` né alle edge function (`gestione-sinistri`): il wizard esistente resta la singola fonte di verità.

3. Verifica rapida che gli altri punti di ingresso ("Apertura" dal menu Sinistri, link da polizza, ecc.) continuino a funzionare — puntano già a `/sinistri/apertura`.

## Test/regression da aggiornare
- `tests/e2e/06-sinistri.spec.ts`: il test "il wizard Nuovo Sinistro si apre allo step 1 (Seleziona Polizza)" oggi si aspetta un `dialog`. Va aggiornato per attendersi la **navigazione** a `/sinistri/apertura` e la presenza dell'heading "Apertura Nuovo Sinistro".
- `tests/sinistri.spec.ts`: lo scenario completo cerca placeholder/etichette del vecchio dialog inline ("Numero polizza", "Cerca Polizze", "Es. SIN-2026-001", ecc.). Va riallineato al flusso del wizard ufficiale (oppure marcato `test.skip` se la copertura è già garantita da test del wizard).

## File toccati
- `src/pages/SinistriList.tsx` — rimozione dialog inline + redirect.
- `tests/e2e/06-sinistri.spec.ts` — aggiornamento assert.
- `tests/sinistri.spec.ts` — aggiornamento/skip selettori.

## Fuori scope
- Nessuna modifica allo schema DB o alle edge function.
- Nessun ridisegno del wizard `SinistroAperturaWizardPage`.
- Le altre tab/persistenza `?tab=` introdotte in precedenza restano invariate.
