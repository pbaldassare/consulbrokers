

## Piano: Rimuovere riferimenti a Varese dal cliente "Comune di Varese"

### Dati da modificare

Il cliente `16f2caf6-c840-4b2c-b504-6968ca698ad7` (Comune di Varese) ha questi riferimenti da rendere generici:

| Campo | Attuale | Nuovo |
|-------|---------|-------|
| `ragione_sociale` | Comune di Varese | Comune |
| `email` | protocollo@comune.varese.it | protocollo@comune.it |
| `pec` | protocollo@pec.comune.varese.it | protocollo@pec.comune.it |
| `citta_sede` | Varese | (vuoto o generico) |
| `provincia_sede` | VA | (vuoto o generico) |
| `cap_sede` | 21100 | (vuoto o generico) |
| `telefono` | 0332 255111 | (da rimuovere?) |
| `note` | "...Comune di ~80.000 abitanti..." | Togliere riferimenti specifici |

Inoltre vanno aggiornati:
- **`profiles`** (email: protocollo@comune.varese.it → protocollo@comune.it)
- **`auth.users`** (email: protocollo@comune.varese.it → protocollo@comune.it) — serve Edge Function con service_role

### Azione

**1. Migrazione SQL** per aggiornare `clienti` e `profiles`:
- UPDATE clienti SET ragione_sociale, email, pec, citta_sede, provincia_sede, cap_sede, note (pulite)
- UPDATE profiles SET email

**2. Edge Function** (o update auth via admin API) per cambiare email in `auth.users` — necessario perché è l'email di login

### Nota
Il secondo cliente a Varese (FARMACCOUNT SRL) non ha riferimenti email a varese.it, quindi resta invariato. Confermi di voler rendere generici anche indirizzo/CAP/provincia/telefono, o solo le email e ragione sociale?

