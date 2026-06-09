# Test E2E (Playwright)

Suite end-to-end che copre login, navigazione su tutte le pagine principali del
gestionale e i form/azioni chiave (Clienti, Polizze, Trattative, Sinistri).

## Credenziali

I test usano un utente reale. Imposta le variabili d'ambiente (consigliato) oppure
si usano i valori di default definiti in `tests/helpers/auth-helper.ts`:

```sh
export TEST_USER_EMAIL="cloude@gmail.com"
export TEST_USER_PASSWORD="Leone123!"
```

L'utente deve esistere su Supabase e avere accesso al gestionale (idealmente ruolo
`admin` per coprire anche le pagine di Sistema; con ruoli inferiori le pagine
protette vengono reindirizzate dai guard e i test restano comunque verdi perché
verificano solo che non ci siano crash/404).

## Esecuzione

```sh
# installa i browser Playwright (una tantum)
npx playwright install chromium

# avvia tutta la suite e2e (il dev server viene avviato in automatico su :8080)
npm run test:e2e

# solo i nuovi test e2e
npx playwright test tests/e2e

# un singolo file
npx playwright test tests/e2e/03-clienti.spec.ts

# report HTML
npx playwright show-report
```

## Struttura

| File | Copertura |
|---|---|
| `helpers/auth-helper.ts` | login/logout, lista rotte, helper `expectPageHealthy` |
| `e2e/00-auth.setup.ts` | login una volta e salvataggio sessione (`tests/.auth/user.json`) |
| `e2e/01-login.spec.ts` | form login, password errata, reset, show/hide, logout, redirect protetto |
| `e2e/02-navigation.spec.ts` | smoke su ~70 rotte: no crash, no 404, no espulsione al login |
| `e2e/03-clienti.spec.ts` | intestazione, ricerca, dialog "Nuovo Cliente" |
| `e2e/04-polizze.spec.ts` | elenco polizze, dialog "Nuovo Titolo", portafoglio attive |
| `e2e/05-trattative.spec.ts` | intestazione, ricerca, dialog "Nuova Trattativa" |
| `e2e/06-sinistri.spec.ts` | intestazione, ricerca, wizard "Nuovo Sinistro", sottopagine |
| `e2e/07-navigazione-ui.spec.ts` | sidebar, menu utente, dashboard |

I file sono numerati: `00-auth.setup.ts` viene eseguito per primo e salva la sessione
riusata dagli altri (`workers: 1`, esecuzione ordinata). I test di interazione non
salvano dati nel DB (aprono i form e li chiudono con `Escape`).
