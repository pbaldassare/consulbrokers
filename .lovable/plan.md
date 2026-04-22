

## Specialist nella card "Assegnazioni Gestionali"

### Cosa cambia in `src/pages/ClienteDetail.tsx`

Porto anche **Specialist** nella card in alto, accanto a Sede e Gruppo Finanziario.

1. **Card "Assegnazioni Gestionali"** → grid a **3 colonne affiancate** (su desktop; 1 colonna su mobile):
   - Sinistra: **Sede *** (`ufficio_id`)
   - Centro: **Gruppo Finanziario *** (`gruppo_finanziario_id`)
   - Destra: **Specialist *** (`backoffice_user_id`), `SearchableSelect` con elenco utenti che hanno ruolo `backoffice` (stessa fonte già usata in "Codici Commerciali (Rete)").
   - Bordo rosso `isFieldMissing` quando vuoto, asterisco rosso nell'etichetta, hint "Campo obbligatorio".

2. **Sincronizzazione bidirezionale** con la sezione "Codici Commerciali (Rete)": il `SearchableSelect` Specialist resta visibile **anche** lì, agganciato allo stesso campo `editFields.backoffice_user_id`. Modifica in un punto → aggiorna l'altro.

3. **Testo informativo** sotto la card: rimuovo la riga "Specialist obbligatorio, si gestisce in 'Codici Commerciali (Rete)'" (ora non serve più, è lì sopra).

4. **Validazione**: `backoffice_user_id` resta in `requiredFieldsList`, counter "Compila i campi obbligatori (N)" e blocco Salva invariati.

### Cosa NON tocco

- DB, RLS, Edge Functions.
- Logica sync Specialist (regole legate a `backoffice_assignment-logic`: assegnazione globale per cliente).
- Email obbligatoria, Sede e Gruppo Finanziario (già fatti).
- Altre card e sezioni.

### Verifica

1. Apro ADINOLFI → card in alto mostra **3 colonne**: Sede ("Ufficio di Napoli") | Gruppo Finanziario ("EP_STRUM") | Specialist (es. "Mario Rossi"), tutti con asterisco.
2. Svuoto Specialist nella card in alto → bordo rosso, counter sale, anche il select in "Codici Commerciali (Rete)" risulta vuoto.
3. Cambio Specialist da "Codici Commerciali (Rete)" → si aggiorna anche nella card in alto.
4. Su mobile (< 768px) le 3 colonne si impilano verticalmente.
5. Compilo Sede + Gruppo + Specialist + Email valida → counter sparisce, Salva abilitato.

