

## Compilazione automatica forzata da Codice Fiscale

### Problema

Nello screenshot il CF `BBTNDR71R12F839C` è valido ma:
- Data di Nascita = `31/03/2026` (sbagliata, dovrebbe essere `12/10/1971`)
- Luogo di Nascita = `Avellino (AV)` (sbagliato, dovrebbe essere `Monza (MB)`)

Gli hint di coerenza appaiono correttamente ("Data non coerente — atteso 12/10/1971", "Luogo non coerente — atteso Monza"), ma i campi non vengono auto-corretti perché la logica attuale di `handleCFAutoFill` sovrascrive solo se il campo è vuoto o coincide con un valore precedentemente auto-derivato. Dati pre-esistenti / inseriti a mano restano intoccati.

### Soluzione

Trasformo la coerenza CF da soft-warning a **auto-correzione esplicita**, con due livelli:

1. **Pulsante "Compila da CF"** accanto al campo Codice Fiscale (visibile solo in edit mode quando il CF è valido a 16 char). Click → sovrascrive sempre `sesso`, `data_nascita`, `luogo_nascita`, `comune_nascita`, `provincia_nascita` con i valori derivati. Toast: "Dati allineati al Codice Fiscale".

2. **Auto-fix inline** quando il CF viene digitato/incollato (il `handleCFAutoFill` esistente che scatta a 16 char): cambio `canOverwrite` in **sovrascrittura sempre forzata** per i campi derivati dal CF (Data nascita, Luogo nascita, Comune, Provincia, Sesso). Il CF è autorevole per definizione: se l'utente lo cambia o lo digita, gli altri campi seguono. L'utente può sempre modificare i campi DOPO la digitazione del CF e da lì restano intoccati (perché non si retriggera l'autofill se il CF non cambia).

3. **Hint giallo di coerenza** resta per i casi residui (es. CF già presente, data modificata a mano dopo): inalterato.

### File toccato

`src/pages/ClienteDetail.tsx` (unico file):

- `handleCFAutoFill` (riga 1258): rimuovo la guardia `canOverwrite` e sovrascrivo sempre i 5 campi derivati. Rimuovo `lastAutoFilledCFRef` ormai inutile.
- Nel rendering del campo `Codice Fiscale` (privati) aggiungo il pulsante "Compila da CF" (icona `Sparkles` o testuale) che invoca `handleCFAutoFill(ef.codice_fiscale)`. Visibile se `!readOnly && ef.codice_fiscale?.length === 16 && parseCF(ef.codice_fiscale)`.

### Cosa NON tocco

- Schema DB, RLS, Edge Functions, altri tab.
- Logica di validazione obbligatori, blocco Salva, hint di coerenza (resta per modifiche post-CF).
- `parseCF`, `comuniItaliani`, `SearchableSelect`.
- Aziende: la logica CF azienda → P.IVA invariata.

### Verifica

1. Apri il cliente in screenshot, entra in edit. Cancella e ridigita il CF `BBTNDR71R12F839C` → Data si aggiorna a `12/10/1971`, Luogo a `Monza (MB)`. Toast informativo.
2. Senza ridigitare il CF, clicca il nuovo pulsante "Compila da CF" → stesso effetto, allinea i campi anche se il CF era già lì.
3. Modifica manualmente la data DOPO l'autofill → il warning giallo "Data non coerente" appare di nuovo (e resta finché non si ricompila). Salva non bloccato.
4. Cliente azienda: nessun cambio di comportamento.

