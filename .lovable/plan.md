

## Piano: Estendere gli automatismi CF a tutte le pagine con Codice Fiscale

### Stato attuale

L'auto-compilazione da CF funziona solo in **ClientiList.tsx** (creazione) e **ClienteDetail.tsx** (modifica). Ci sono altre 3 pagine con campi Codice Fiscale che non hanno questo automatismo:

1. **AnagraficheProfessionaliPage.tsx** — form creazione/modifica anagrafiche (periti, AE, legali, ecc.) con campo `codice_fiscale` (riga 618)
2. **GestioneUtenti.tsx** — form modifica utente con campo `codice_fiscale` (riga 561)
3. **CompagnieList.tsx** — form compagnia con campo `codice_fiscale` (riga 312)

### Cosa viene aggiunto

In ciascuna pagina, quando il campo Codice Fiscale raggiunge 16 caratteri validi, il sistema chiama `parseCF()` e auto-compila i campi correlati disponibili (solo se vuoti):

| Pagina | Campi auto-compilati |
|---|---|
| **AnagraficheProfessionaliPage** | Non ha campi sesso/data nascita, ma il CF viene convertito uppercase automaticamente per coerenza |
| **GestioneUtenti** | Non ha sesso/nascita nel form, ma uppercase + validazione formato |
| **CompagnieList** | Le compagnie sono persone giuridiche: uppercase + se CF = 11 cifre viene copiato anche in Partita IVA (se vuota) |

In realta il vero automatismo utile e piu ampio: **uppercase automatico** su tutti i campi CF e P.IVA, e **copia CF → P.IVA** quando coincidono (persone giuridiche con CF numerico di 11 cifre = P.IVA).

Inoltre, aggiungo l'auto-fill CF anche in **DocPrecontrattualePage.tsx** dove si cerca un cliente per CF e si potrebbe auto-popolare indirizzo.

### Modifiche per file

| File | Modifica |
|---|---|
| **AnagraficheProfessionaliPage.tsx** | Import `parseCF`, uppercase su onChange del campo CF, toast se formato non valido a 16 char |
| **GestioneUtenti.tsx** | Uppercase su onChange del campo CF |
| **CompagnieList.tsx** | Uppercase su CF, auto-copia CF→P.IVA se CF numerico 11 cifre e P.IVA vuota |
| **ClientiList.tsx** | Aggiungere auto-copia CF azienda → P.IVA se CF numerico 11 cifre e P.IVA vuota |
| **ClienteDetail.tsx** | Stesso automatismo CF azienda → P.IVA |

### Note tecniche
- Tutti i campi CF vengono forzati uppercase su ogni onChange (non solo a 16 char)
- Per le aziende: se il CF inserito ha 11 cifre (formato P.IVA), viene copiato automaticamente nel campo Partita IVA se vuoto
- Nessuna modifica DB

