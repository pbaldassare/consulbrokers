Il problema attuale non è più la UI: la funzione `create-user` contiene ancora un crash lato Edge Function. Nel file c'è una doppia dichiarazione di `const adminClient`, quindi la funzione fallisce prima di creare lo Specialist e il catch restituisce ancora `supabaseKey is required`/errore interno.

Piano di intervento:

1. Correggere `supabase/functions/create-user/index.ts`
   - Rimuovere la seconda dichiarazione duplicata di `adminClient`.
   - Usare un solo client admin per validare JWT, leggere ruolo admin, creare utente, profilo, ruolo e log.
   - Rendere il catch più robusto tipizzando l'errore senza far esplodere la funzione.

2. Rafforzare la validazione runtime
   - Mantenere il controllo esplicito su `SUPABASE_URL` e chiave service/secret.
   - Restituire un errore leggibile se manca la configurazione, invece di un 500 generico.
   - Non loggare mai valori delle chiavi, solo presenza/assenza.

3. Verifica mirata
   - Controllare che la funzione non abbia più duplicati/sintassi che causano crash.
   - Dopo l'applicazione, riprovare “Crea Specialist” dalla UI o tramite test della funzione per verificare che non ritorni più 500.