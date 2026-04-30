## Problema

Il dialog "Nuovo Specialist" (vedi screenshot) raccoglie solo i campi minimi (Cognome / Nome / Email / Sede / Telefono / CF / Password), ma serve raccogliere già in creazione **tutti i dati** richiesti — gli stessi del dialog di Modifica:
- Dati base + Codice contabile + Descrizione + Fax
- Indirizzo (con autocomplete) + CAP / Città / Provincia
- **Dati RUI strutturati**: Nome RUI, Sezione, Numero, Data iscrizione (DatePicker)
- Percentuali: Provvigione / Consulenza / RA
- Banca: IBAN + Intestatario C/C

## Modifiche

### `src/components/anagrafiche/SpecialistList.tsx`

1. Estendere lo state `newUser` con tutti i campi sopra (default "").
2. Trasformare il dialog "Nuovo Specialist" in un layout a **tabs** identico a quello di Modifica:
   - **Dati** (Codice contabile, Sede *, Cognome *, Nome, Descrizione, Email *, CF, Telefono, Fax, Password iniziale *)
   - **Indirizzo** (`AddressAutocomplete` + CAP/Città/Provincia)
   - **RUI** (Nome RUI, Sezione, Numero, Data iscrizione — `DateField`)
   - **Provvigioni** (% Base, % Consulenza, % RA)
   - **Banca** (IBAN uppercase, Intestatario C/C)
3. La `createMutation` invierà tutti i campi all'edge function `create-user` (che già li accetta tutti — verificato: nome_rui, data_iscrizione_rui, numero_rui, sezione_rui, codice_contabile, percentuale_ra, iban, intestatario_cc sono già nel destructuring).
4. Le percentuali vengono convertite a `Number()` se non vuote.
5. Reset state al chiudere/successo via `initialNewUser`.

### `supabase/functions/create-user/index.ts`

L'edge function attualmente non passa al `profiles.insert` i campi: `percentuale_base`, `percentuale_consulenza`. Vanno aggiunti al destructuring e all'insert per coerenza con il dialog.

### File toccati

- `src/components/anagrafiche/SpecialistList.tsx` — espansione form Nuovo Specialist con tabs
- `supabase/functions/create-user/index.ts` — aggiunta `percentuale_base` e `percentuale_consulenza` all'insert profilo
- `public/version.json` — bump

### Note

- Restano obbligatori solo: Cognome, Email, Sede, Password. Tutti gli altri campi sono opzionali ma compilabili subito.
- Il trigger DB `validate_profilo_sede_required` continua a garantire la Sede obbligatoria.
- Stesso pattern andrà replicato per "Nuovo Produttore" se confermato — non incluso ora per non ampliare lo scope.
