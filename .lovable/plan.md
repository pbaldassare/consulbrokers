

## Campi obbligatori + coerenza con Codice Fiscale (ClienteDetail – tab Anagrafica)

### Cosa diventa obbligatorio

**Cliente PRIVATO** (4 campi):
- Codice Fiscale (16 char alfanumerici, formato CF italiano valido)
- Data di Nascita
- Luogo di Nascita
- Indirizzo Residenza

**Cliente AZIENDA / ENTE** (3 campi):
- Partita IVA (11 cifre) **o** Codice Fiscale Azienda (almeno uno dei due)
- Forma Giuridica
- Indirizzo Sede

> Per ora come da richiesta partiamo dal privato; estendo la stessa logica all'azienda (stessa UX) così la regola è coerente in tutta la pagina.

### UI

1. **Asterisco rosso `*`** accanto alla label dei campi obbligatori — modifico `FieldInput`, `FieldSelect`, `FieldAddress` aggiungendo una prop `required?: boolean`. Quando `required` è true la label mostra `Label *` con asterisco in `text-destructive`.
2. **Bordo rosso** sull'input quando è in edit mode, vuoto e obbligatorio (`border-destructive`).
3. **Hint sotto il campo** in rosso piccolo (`text-xs text-destructive`) quando vuoto: "Campo obbligatorio".
4. **Hint di coerenza CF** (solo privati): se il CF è valido (16 char) e `data_nascita` / `luogo_nascita` divergono da quanto decodificato da `parseCF` + `lookupComune`, mostro hint giallo (`text-amber-600`) sotto il campo:
   - "Data di nascita non coerente con il CF (atteso: 15/03/1971)"
   - "Luogo di nascita non coerente con il CF (atteso: NAPOLI)"
   L'utente può comunque salvare (warning soft, non blocca) — il blocco scatta solo per i campi vuoti.

### Validazione + blocco salvataggio

Aggiungo una funzione locale `getMissingRequiredFields(ef, isPrivato): string[]` che ritorna la lista dei campi obbligatori vuoti.

- Il bottone **Salva** (riga 1071) diventa `disabled={saveDetailsMutation.isPending || missingRequired.length > 0}`.
- Quando disabilitato, mostro un piccolo testo a fianco: "Compila i campi obbligatori (N)" in `text-destructive`.
- Doppio safety-net: dentro `saveDetailsMutation.mutationFn`, se `missingRequired.length > 0` faccio `throw new Error("Campi obbligatori mancanti: …")` che mostra toast d'errore (utile se qualcuno bypassa il disabled via DevTools).

### Auto-fill già presente, rafforzato

`handleCFAutoFill` già popola `data_nascita`, `comune_nascita`, `provincia_nascita`, `sesso` quando il CF arriva a 16 char. Questa funzione resta invariata. La novità è che, una volta auto-popolati, se l'utente li modifica a mano in modo divergente vede il warning di coerenza descritto sopra (calcolato live ad ogni render confrontando `ef.data_nascita` vs `parseCF(ef.codice_fiscale).dataNascita`).

> **Nota sul campo "Luogo di Nascita"**: nello schema il valore della UI è `luogo_nascita` (stringa libera), mentre `parseCF` produce comune+provincia separati che finiscono in `comune_nascita`/`provincia_nascita`. Per la verifica di coerenza confronto `ef.luogo_nascita.toUpperCase()` con `lookupComune(parsed.codiceCatastale).comune.toUpperCase()` (match sostring, così "NAPOLI (NA)" continua a matchare "NAPOLI").

### File toccato

- `src/pages/ClienteDetail.tsx` — unico file.
  - Aggiungo prop `required` a `FieldInput`, `FieldSelect`, `FieldAddress` (rendering label + bordo + hint).
  - Aggiungo helper `getMissingRequiredFields` + `getCFCoherenceWarnings` nel corpo del componente principale.
  - Marco `required` sui campi previsti (righe 1229-1235 per privato, 1239-1252 per azienda).
  - Aggiorno il bottone Salva (riga 1071) e la `saveDetailsMutation` (riga 809).

### Cosa NON tocco

- Schema DB (nessuna constraint NOT NULL aggiunta — i record esistenti hanno spesso campi vuoti, romperei le query).
- RLS, Edge Functions, altri tab (Polizze, Sinistri, Documenti, Chat, Timeline, Trattative, Dati Statistici, Codici Commerciali).
- Logica auto-fill da CF: già presente e funzionante, resta invariata.
- Pagine `ClientiList`, `ProspectDetail`, `ClienteAnagrafica` (portale cliente, sola lettura).

### Verifica

1. Apri un cliente privato esistente con CF valido ma senza data di nascita → entro in edit, vedo asterischi rossi su CF/Data nascita/Luogo/Indirizzo, bottone Salva disabilitato, scritta "Compila i campi obbligatori (3)".
2. Compilo i 3 campi → asterischi restano (segnalano obbligatorietà) ma il bordo rosso sparisce, Salva si abilita.
3. Modifico la data di nascita in modo divergente dal CF → appare hint giallo "Data non coerente (atteso: …)", Salva resta abilitato (warning soft).
4. Su un cliente azienda esistente: stesso comportamento su P.IVA / CF Azienda / Forma Giuridica / Sede.
5. Salvo: tutto OK, dati persistiti.

