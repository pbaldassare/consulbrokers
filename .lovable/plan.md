

## Sede + Gruppo Finanziario affiancati e Email obbligatoria

### Cosa cambia in `src/pages/ClienteDetail.tsx`

1. **Card "Assegnazioni Gestionali"** (in alto): da 1 colonna a **2 colonne affiancate**:
   - Colonna sinistra: **Sede *** (come ora, `ufficio_id`).
   - Colonna destra: **Gruppo Finanziario *** (`gruppo_finanziario_id`), `SearchableSelect` identico a quello in fondo, con stesso bordo rosso `isFieldMissing` quando vuoto.
   - Aggiorno il testo informativo sotto: "Specialist obbligatorio, si gestisce in 'Codici Commerciali (Rete)'".
   - Il `SearchableSelect` Gruppo Finanziario resta **anche** nella sezione "Dati Statistici" (sincronizzato sullo stesso campo `editFields.gruppo_finanziario_id`), così modificarlo da una parte aggiorna l'altra automaticamente.

2. **Email obbligatoria**:
   - Aggiungo `email` (campo `cliente.email`) a `requiredFieldsList` per **tutti i tipi cliente** (privato/azienda/ente).
   - Validazione: non vuota + formato email valido (regex semplice già usata altrove o `z.string().email()`).
   - Etichetta "Email" → "Email *", bordo rosso quando vuota o non valida, hint "Campo obbligatorio" / "Email non valida".
   - Counter "Compila i campi obbligatori (N)" e blocco Salva includono Email.

### Cosa NON tocco

- DB, RLS, Edge Functions.
- Logica sync Specialist, auto-fill CF, indirizzi, altre sezioni.
- Layout altre card.

### Verifica

1. Apro ADINOLFI → card in alto mostra Sede ("Ufficio di Napoli") **a sinistra** e Gruppo Finanziario ("EP_STRUM - Enti Pubblici") **a destra**, entrambi con asterisco.
2. Svuoto Gruppo Finanziario nella card in alto → bordo rosso, counter sale, anche il select in "Dati Statistici" risulta vuoto.
3. Lascio Email vuota → campo Email diventa rosso con hint "Campo obbligatorio", counter include Email, Salva bloccato.
4. Inserisco email malformata ("foo@") → bordo rosso, hint "Email non valida", Salva bloccato.
5. Compilo email valida + Sede + Gruppo + Specialist → counter sparisce, Salva abilitato.

