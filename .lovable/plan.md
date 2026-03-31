

## Piano: Importare Corrispondenti come utenti con ruolo dedicato

### Dati ricevuti
Il file Excel contiene ~260 record di corrispondenti con campi: Descrizione, Azienda/Cognome, Nome, Indirizzo, Località, Prov, Cap, %Base, Cd For (codice fornitore), %Ra, Tel, Fax, Mail, Rui, Abi, Cab, Iban, IntestatarioCC. Molti record non hanno email — genereremo email fake per quelli.

### Modifiche

**1. Database — Nuovo ruolo `corrispondente`**
- Aggiungere `corrispondente` all'enum `app_role`
- Questo permette di assegnare il ruolo nella tabella `user_roles`

**2. Edge Function — `provision-corrispondenti-users`**
- Nuova Edge Function che:
  - Riceve l'array di record dal frontend
  - Per ogni corrispondente con dati sufficienti (nome/cognome o ragione_sociale):
    - Se manca l'email, genera una fake: `cognome.nome@corrispondente.consulbrokers.fake` (o variante con codice fornitore)
    - Crea account auth (password `Leone123!`)
    - Crea profilo in `profiles` con `ruolo = 'corrispondente'`
    - Inserisce in `user_roles` con role `corrispondente`
    - Mappa i campi: indirizzo, cap, citta, provincia, telefono, fax, numero_rui, percentuale_base, percentuale_ra, iban, intestatario_cc, codice_contabile (da Cd For)
  - Salta le righe che sono "SEDE ..." o vuote (intestazioni di sezione)
  - Opera in batch, restituisce conteggio successi/errori

**3. Pagina UI — Trigger importazione**
- Aggiungere nella pagina `ManutenzionePage` (o `AnagraficheProfessionaliPage`) un bottone "Provisioning Corrispondenti" che:
  - Legge i corrispondenti dalla tabella `anagrafiche_professionali` dove `tipo = 'corrispondente'`
  - Chiama la Edge Function per creare gli account
  - Mostra risultato

**4. Aggiornamenti vari**
- `AuthGuard.tsx`: se ruolo `corrispondente`, redirect a dashboard (stesse pagine del produttore)
- `SitemapPage.tsx`: aggiungere ruolo "Corrispondente" al livello 3, stessi privilegi del Produttore
- `GestioneUtenti.tsx`: aggiungere label `corrispondente: "Corrispondente"` nel mapping ruoli
- `AppSidebar.tsx`: se ruolo `corrispondente`, stessa sidebar del produttore

**5. Caricamento dati iniziale**
- Lo script di importazione parserà l'Excel e caricherà i dati tramite la Edge Function
- Filtra le righe "SEDE ...", righe vuote, e righe senza nome/cognome/ragione_sociale
- ~180-200 record utili stimati (molti sono sedi o duplicati)

### File coinvolti
| Azione | File |
|--------|------|
| Migrazione | ALTER TYPE app_role ADD VALUE 'corrispondente' |
| Nuovo | `supabase/functions/provision-corrispondenti-users/index.ts` |
| Modifica | `src/pages/ManutenzionePage.tsx` — bottone provisioning |
| Modifica | `src/components/AuthGuard.tsx` — gestione ruolo corrispondente |
| Modifica | `src/pages/SitemapPage.tsx` — nuovo ruolo |
| Modifica | `src/pages/GestioneUtenti.tsx` — label ruolo |

### Email fake
Per i record senza email, formato: `cognome.nome@corr.consulbrokers.local` (o `ragionesociale@corr.consulbrokers.local` per le aziende). Se duplicati, aggiunge suffisso numerico.

