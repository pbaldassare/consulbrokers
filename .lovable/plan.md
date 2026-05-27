Problema reale: la chiamata “Crea Specialist” arriva a `supabase/functions/create-user/index.ts`, ma la funzione risponde ancora 500 con `supabaseKey is required`. Questo indica che nel runtime Edge viene ancora creato un client Supabase con chiave mancante/non risolta, oppure la funzione deployata non sta usando il fix corretto.

Do I know what the issue is? Sì: il punto fragile è la risoluzione della chiave admin nella Edge Function `create-user`. Va resa compatibile con le variabili Supabase attuali e verificata sul runtime deployato, non solo nel file locale.

Piano di intervento:

1. Rendere robusta la risoluzione delle chiavi nella funzione `create-user`
   - Leggere `SUPABASE_URL`.
   - Leggere la chiave admin da tutte le varianti supportate:
     - `SUPABASE_SERVICE_ROLE_KEY`
     - dizionario JSON `SUPABASE_SECRET_KEYS.default`
     - fallback legacy già presente, se disponibile.
   - Non loggare mai il valore della chiave, solo presenza/assenza.
   - Usare `createClient` solo dopo aver verificato che URL e chiave siano stringhe valide.

2. Stabilizzare la funzione Edge
   - Usare un solo `adminClient` per:
     - validare il JWT del chiamante;
     - verificare ruolo admin;
     - creare utente Auth;
     - creare profilo `profiles`;
     - inserire `user_roles`;
     - scrivere log attività.
   - Impostare `auth: { autoRefreshToken: false, persistSession: false }` nel client server-side.
   - Migliorare il `catch` per restituire errori diagnostici chiari e non generici.

3. Sistemare l’assegnazione ruolo Specialist
   - Verificare che `ruolo: "backoffice"` venga inserito correttamente in `profiles` e `user_roles`.
   - Se l’utente Auth viene creato ma il profilo fallisce, mantenere rollback eliminando l’utente appena creato.
   - Se l’email esiste già, restituire un messaggio leggibile invece di un errore generico.

4. Deploy e verifica runtime
   - Deploy immediato della funzione `create-user`.
   - Testare la funzione deployata con una richiesta diretta.
   - Controllare i log Edge Function dopo il test.
   - Verificare che la risposta non sia più `supabaseKey is required`.

5. Verifica UI
   - Ritestare il flusso “Nuovo Specialist” dalla pagina `Anagrafiche Amministrative`.
   - Confermare che il toast di errore sparisca e che il nuovo Specialist venga creato/visualizzato.

File coinvolti:
- `supabase/functions/create-user/index.ts`

Non toccherò database o UI a meno che dai test emerga un errore diverso dopo aver risolto la chiave Edge Function.

<presentation-actions>
<presentation-link url="https://supabase.com/dashboard/project/zbjmnnlojxprlogbnxef/functions/create-user/logs">Log create-user</presentation-link>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>