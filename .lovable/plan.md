## Obiettivo

Creare in DB una nuova utenza Specialist (ruolo `backoffice`) per **Paola Scarpelli**, collegata alla **Sede Napoli**, con i dati RUI già compilati.

## Dati da inserire

| Campo | Valore |
|---|---|
| Nome | Paola |
| Cognome | Scarpelli |
| Email | pscarpelli@consulbrokers.it |
| Telefono | 081 7648268 |
| Sede (ufficio) | Napoli |
| Sezione RUI | E |
| Numero RUI | E000354024 |
| Data iscrizione RUI | 14/09/2010 |
| Password iniziale | Leone123! |
| Ruolo | `backoffice` (Specialist L4) |
| Permessi | default L4 da `LEVELS[2].defaultPermissions` |

Provvigioni, IBAN, indirizzo e codice contabile restano vuoti — completabili dopo dalla scheda di modifica.

## Operazioni

1. **Lookup `ufficio_id` Sede Napoli** tramite query su `uffici` (per non hardcodare un UUID).
2. **Invocare l'edge function `create-user`** già esistente (deployata) con il payload completo:
   - crea utente in `auth.users` con email + password `Leone123!` (email_confirm: true)
   - crea record in `profiles` con tutti i campi sopra
   - assegna `user_roles.role = 'backoffice'`
   - logga in `log_attivita`
3. **Verifica post-creazione** con query su `profiles` per confermare che l'utenza sia presente con Sede Napoli e dati RUI corretti.

## Note

- Nessuna modifica a codice o schema: si usa solo l'infrastruttura già pronta (edge function `create-user`).
- Il trigger `validate_profilo_sede_required` accetta perché passiamo `ufficio_id`.
- Il trigger `sync_iscrizione_rui_text` formatterà automaticamente `iscrizione_rui` come "14/09/2010".
- L'email `pscarpelli@consulbrokers.it` deve essere libera in `auth.users`; in caso di duplicato avviso e chiedo come procedere (alias `+napoli` oppure reset password sull'utenza esistente).

## File toccati

Nessuno. Solo chiamate runtime (edge function + query verifica) + bump `public/version.json`.
