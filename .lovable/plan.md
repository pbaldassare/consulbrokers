## Obiettivo

Nel form "Documentazione Precontrattuale", il campo **Intermediario** deve permettere di scegliere tra tre tipologie di soggetti e avere ricerca:

1. **Account Executive** (AE)
2. **Specialist** (Backoffice)
3. **Produttore** (Consul / Produttore Sede)

Alla selezione, i campi RUI (Nome, Sezione, Numero, Data iscrizione, Indirizzo, CAP, Città, Prov, Email, Tel) devono essere auto-popolati dal soggetto scelto.

## UI

In `src/pages/DocPrecontrattualePage.tsx`, sostituire l'attuale input/selettore "Intermediario" con due controlli affiancati:

- **Tipo intermediario** (Select piccolo): `Account Executive` | `Specialist` | `Produttore`
- **Intermediario** (`SearchableSelect` — Popover + Command, come da convenzione progetto): lista filtrata in base al tipo, con search box che filtra per cognome/nome/sigla/codice.

Mantenere il prefill automatico esistente (quando si arriva da un cliente, viene preselezionato lo Specialist Backoffice assegnato), ma rendere modificabile sia il tipo sia il soggetto.

## Fonti dati

| Tipo UI | Tabella / filtro |
|---|---|
| Account Executive | `anagrafiche_professionali` WHERE `tipo='account_executive'` AND `attivo=true` |
| Specialist | `profiles` WHERE `ruolo='backoffice'` AND `attivo=true` |
| Produttore | `anagrafiche_professionali` WHERE `tipo IN ('produttore_sede','corrispondente')` AND `attivo=true` |

Campi letti per il prefill RUI:
- `anagrafiche_professionali`: `cognome, nome, nome_rui, sezione_rui, numero_rui, iscrizione_rui, indirizzo, cap, citta, provincia, email, telefono`
- `profiles`: `cognome, nome, nome_rui, sezione_rui, numero_rui, data_iscrizione_rui, indirizzo, cap, citta, provincia, email, telefono` (+ fallback `email/telefono` da `uffici` collegato a `ufficio_id`)

## Comportamento

1. Cambiando il **Tipo**, si svuota la selezione e si ricarica la lista (3 React Query keys separate, una per tipo).
2. Selezionando un soggetto:
   - Si compilano automaticamente i 10 campi RUI dell'intermediario (gli stessi `setNomeCognomeRui`, `setSezioneRui`, ecc. già presenti).
   - I campi restano modificabili a mano (l'utente può correggere prima di generare il PDF).
3. La generazione PDF (`buildData()` → `buildPrecontrattualePdf`) non cambia: usa già gli stati `nomeCognomeRui`, `sezioneRui`, `numeroRui`, `dataIscrizione`, `emailRui`, `telRui`, `indirizzoRui/capRui/cittaRui/provinciaRui`.

## File modificati

- `src/pages/DocPrecontrattualePage.tsx` — nuovi state `tipoIntermediario` + `intermediarioId`, 3 query (AE, Specialist, Produttore), sostituzione del selettore con `SearchableSelect`, `useEffect` che popola i campi RUI alla selezione.
- `public/version.json` — bump versione.

Nessuna modifica a DB o edge functions.
