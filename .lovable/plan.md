## Obiettivo
Uniformare e blindare il form **Nuovo Cliente** (`NuovoClienteDialog.tsx`) per Privato / Azienda / Ente.

## Cambi richiesti

### 1. Sezione "Contatti" → solo nel posto giusto
- **Eliminare** il blocco "Contatti" in fondo al form (riga ~941-948 con Email / Telefono / PEC).
- **Spostare i 3 campi** dentro le sezioni anagrafica esistenti, sopra l'indirizzo di residenza/sede:
  - **Privato**: nuova riga `Email * | Telefono | PEC` subito sopra "Indirizzo Residenza".
  - **Azienda / Ente**: nuova riga `Email * | Telefono | PEC` subito sopra "Indirizzo Sede" (PEC resta editabile, già auto-popolata da visura).
- L'Email Referente di Azienda/Ente resta dov'è (nel blocco Referente).
- Risultato: l'utente vede tutti i contatti del soggetto principale insieme al suo indirizzo, niente sezione separata "Contatti".

### 2. Validazione "a blocchi" sul Codice Fiscale (privato)
Il `FiscalCodeInput kind="cf16"` accetta oggi qualunque carattere finché non si arriva a 16. Aggiungiamo guardrail **input-time** per CF persona fisica:
- 6 caratteri → solo lettere A-Z (auto-uppercase, niente cifre/simboli)
- 7-8 → solo cifre
- 9 → solo lettera (mese)
- 10-11 → solo cifre (giorno)
- 12 → solo lettera
- 13-15 → solo cifre
- 16 → solo lettera (carattere di controllo)
- I caratteri non conformi vengono **silenziosamente filtrati** durante la digitazione (no toast, solo non vengono accettati). A 16 caratteri resta la validazione checksum esistente.
- Implementazione: estendere `FiscalCodeInput` con un nuovo prop opzionale `enforcePattern?: boolean` (default off per non rompere altri usi); quando `kind="cf16"` e `enforcePattern` è true, applicare il filtro per posizione nell'`onChange` interno. Abilitarlo nel dialog Nuovo Cliente.
- CF 11-cifre (azienda/ente) e P.IVA: già limitati a sole cifre dal componente, nessuna modifica.

### 3. Pre-compilazione automatica da CF (privato)
La logica oggi già imposta `sesso`, `dataNascita`, `comuneNascita` (statistico) e `provinciaNascita`. **Aggiungere**:
- `luogoNascita` (campo visibile sopra Indirizzo) → impostarlo a `"<comune> (<provincia>)"` se vuoto, usando `lookupComune(codiceCatastale)`.
- `provinciaResidenza` resta separato (è la residenza, non la nascita).
- Punto unico: nell'`onChange` di `setCodiceFiscale` (riga ~721-736), aggiungere `if (!luogoNascita) setLuogoNascita(\`${info.comune} (${info.provincia})\`);`.

### 4. Sede e Specialist obbligatori (tutti i tipi)
- Aggiungere a `getMissingFields()` il check `if (!backofficeRole.profilo_id) missing.push("Specialist");` (Sede già obbligatoria, riga 417).
- UI: marcare i due `SearchableSelect` "Specialist" e "Sede / Ufficio" con bordo amber quando vuoti (pattern già usato per altri campi obbligatori).
- Aggiungere asterisco `*` alle label "Specialist" e già presente su "Sede / Ufficio *".
- Vale per Privato, Azienda, Ente (la validazione è fuori dal blocco `tipoCliente`).

### 5. Email obbligatoria — già in vigore
È già in `getMissingFields()` per tutti e tre i tipi (righe 423, 436). Confermare comportamento dopo lo spostamento del campo.

## File toccati
- `src/components/clienti/NuovoClienteDialog.tsx` — spostamento Contatti, prefill `luogoNascita`, validazione Specialist obbligatorio, evidenziazione bordo amber.
- `src/components/ui/FiscalCodeInput.tsx` — nuovo prop opzionale `enforcePattern` per filtro per-posizione su `cf16`.

## Fuori scope
- Nessun cambio DB / RLS / migration.
- `ClienteDetail.tsx` (edit) ha già parseCF + lookupComune attivi: nessuna modifica.
- Altri form (Prospect, AnagraficheCompagnie, ImportNuovaPolizzaAI) non vengono toccati: usano già `FiscalCodeInput`, l'`enforcePattern` è opt-in.