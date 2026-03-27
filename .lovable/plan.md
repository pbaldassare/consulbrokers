

## Piano: Creare utente Backoffice GUARRACINO GAETANO + inserire cliente RENT AND EVENTS SRL

### Situazione attuale
- Esiste 1 solo utente backoffice generico ("Backoffice Consul")
- Il cliente RENT AND EVENTS SRL non esiste nel DB
- GUARRACINO GAETANO non esiste come utente

### Cosa fare

**1. Creare utente auth + profilo per GUARRACINO GAETANO (ruolo: backoffice)**
- Usare la Edge Function `create-user` (o inserire direttamente via migrazione/script)
- Email: `gguarracino@consulbrokers.it`
- Nome: GAETANO, Cognome: GUARRACINO
- Ruolo: `backoffice`
- Inserire anche in `user_roles` con role `backoffice` (se necessario per RLS)

**2. Inserire il cliente RENT AND EVENTS SRL**
- Tabella `clienti` con i dati dallo screenshot:
  - Ragione sociale: RENT AND EVENTS SRL
  - Tipo: azienda, Persona: Giuridica
  - Indirizzo: PIAZZA DELLA VITTORIA, 14/A — 86100 CAMPOBASSO CB
  - CF/P.IVA: 01890920703
  - Stato: attivo

### Approccio tecnico
- Edge Function `create-user` per creare l'utente auth GUARRACINO (gestisce auth.users + profiles + user_roles)
- Insert diretto in `clienti` per il cliente RENT AND EVENTS SRL
- Nessuna modifica a tabelle/schema — solo dati

### File da modificare
- Nessun file di codice — solo operazioni dati via Edge Function call + insert SQL

