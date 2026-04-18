
## Diagnosi

L'utente conferma: **se manca l'email, non si può creare l'area riservata cliente**. Questa è la regola da implementare. Niente email obbligatoria a livello di scheda cliente — il cliente può esistere senza email — ma il **provisioning del portale** deve essere bloccato finché l'email non c'è.

In più, dal messaggio precedente:
1. Spostare il toggle **Attivo/Disattivo** dalla tabella `ClientiList` alla card di dettaglio cliente
2. Bloccare creazione utente portale se email mancante

## Soluzione

### 1. `ClientiList.tsx` — pulizia tabella
- Rimuovere lo **switch Attivo** inline dalla riga
- Lasciare eventualmente solo un badge stato (read-only) o rimuovere del tutto la colonna

### 2. `ClienteDetail.tsx` — toggle Attivo nella card
- Aggiungere `<Switch>` "Cliente attivo" nell'header della card cliente, a destra del nome
- Aggiorna `clienti.attivo` su toggle + toast + log attività
- Solo utenti autorizzati (admin/responsabile) possono modificarlo

### 3. Provisioning portale cliente — blocco se email mancante
Nella sezione "Area Riservata" del dettaglio cliente:
- Se `cliente.email` è null/vuota → **pulsante "Crea accesso portale" disabilitato** + alert giallo: *"Inserisci un'email valida per il cliente prima di abilitare l'area riservata"*
- Se email presente → pulsante attivo, chiama `provision-clienti-users` / `create-cliente-user`
- Validazione formato email lato client (regex base) prima della chiamata

## File toccati

- `src/pages/ClientiList.tsx` — rimozione switch dalla tabella
- `src/pages/ClienteDetail.tsx` — switch Attivo nell'header + blocco provisioning portale se email mancante

## Cosa NON cambia

- Schema DB
- Edge function di provisioning (la validazione è lato client; l'edge function già skippa clienti senza email)
- Email NON diventa obbligatoria nel form anagrafica cliente — resta opzionale

## Note

In implementazione verifico la struttura attuale di `ClienteDetail.tsx` per individuare:
- L'header card dove inserire il toggle
- La sezione/pulsante esistente per provisioning portale (se non c'è, lo creo)
