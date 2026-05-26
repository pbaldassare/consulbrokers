## Obiettivo

Su tutti gli indirizzi del cliente (Sede, Residenza, Alternativo, Fiscale) e Prospect, rendere chiaro che si può **scegliere un suggerimento Google** oppure **compilare tutto a mano**. Niente toggle: i 4 campi (Indirizzo, CAP, Città, Provincia) restano sempre visibili e indipendenti, con un piccolo helper text che lo dichiari, e un fallback automatico quando Google non risponde.

## Cosa cambia

### 1. `AddressAutocomplete.tsx`
- Aggiungo prop opzionale `helperText` (default: *"Seleziona un suggerimento Google oppure compila i campi a mano qui sotto"*) renderizzato sotto l'input in stile `text-xs text-muted-foreground`.
- Quando Google fallisce (chiave mancante, `gm_authFailure`, timeout caricamento) → invece di mostrare solo "Autocomplete non disponibile" mostro un banner leggero giallo *"Suggerimenti Google non disponibili — compila i campi manualmente"*. L'input resta perfettamente usabile come `<Input>` libero (già lo è, ma rimuovo l'icona "loader" e disabilito la chiamata predictions).
- Nessuna modifica al contratto `onChange` / `onSelect` → i form esistenti continuano a funzionare.

### 2. Form che usano `AddressAutocomplete`
Per ciascun blocco indirizzo:
- Raggruppo Indirizzo + CAP + Città + Provincia in una piccola "card" con header sottile *"Indirizzo (Sede / Residenza / Alternativo / Fiscale)"* + helper *"Compila Google o a mano"*.
- I 4 Input restano editabili a mano come oggi; aggiungo `autoComplete="off"` per evitare conflitti.
- Quando l'utente seleziona un suggerimento Google, CAP/Città/Provincia vengono pre-compilati ma rimangono modificabili (già è così — lo confermo).

File toccati:
- `src/components/clienti/NuovoClienteDialog.tsx` — Indirizzo Residenza (Privato), Indirizzo Sede (Azienda/Ente), Indirizzo Alternativo, Indirizzo Fiscale.
- `src/pages/ClienteDetail.tsx` — stessi blocchi in modifica.
- `src/pages/ProspectList.tsx` — indirizzo prospect.

### 3. Validazione
Nessun cambio alle validazioni esistenti (`indirizzo`, `cap`, `citta`, `provincia` restano required dove già lo sono). L'utente può quindi salvare con dati interamente digitati a mano.

## Cosa NON cambia

- Niente migrazioni DB.
- Niente toggle / switch UI.
- Niente nuovi campi in tabella `clienti`.
- Gli altri usi di `AddressAutocomplete` (Sedi, Compagnie, Specialist, Sinistri, Template, Precontrattuale) restano invariati — l'helper text è opt-in via prop.

## Verifica

1. `/archivi/clienti` → **Nuovo Cliente** → Azienda: l'Indirizzo Sede mostra l'helper, scrivere "Via Roma 1" e selezionare suggerimento compila CAP/Città/Provincia; poi correggere a mano il CAP → resta editabile; salva → record creato.
2. Stesso flusso su Privato (Residenza) e Ente (Sede).
3. Aprire **Modifica Cliente** → modificare i 4 campi a mano senza usare il popup Google → salva → dati persistiti.
4. Simulare Google KO (network throttle / chiave invalida) → banner giallo, i 4 campi restano compilabili a mano e il salvataggio funziona.
