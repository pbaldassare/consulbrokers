## Piano

1. **Correggere la gestione anagrafica degli Account Executive**
   - In `AnagraficheInternePage`, quando il tipo è `account_executive`, salvare sempre `ufficio_id: null` sia in creazione sia in modifica.
   - La Sede non deve più essere obbligatoria, né ereditata automaticamente dal profilo utente, per gli Account Executive.
   - La Sede resta invece valida per i Produttori/Responsabili Sede secondo le regole attuali.

2. **Ripulire le tendine AE dai residui di fallback per Sede**
   - In `NuovoClienteDialog`, `ImmissionePolizzaPage` e `TitoloDetail`, rimuovere i testi tipo “Nessun AE collegato alla Sede...” perché ormai non deve più esistere alcun collegamento AE-Sede.
   - Usare il lookup globale già presente: tutti gli AE attivi da `anagrafiche_professionali` con `tipo='account_executive'`.

3. **Normalizzare i dati esistenti nel database**
   - Aggiungere una migration che imposta `ufficio_id = NULL` per tutti gli Account Executive già presenti:

   ```sql
   UPDATE public.anagrafiche_professionali
   SET ufficio_id = NULL
   WHERE tipo = 'account_executive'
     AND ufficio_id IS NOT NULL;
   ```

   Questo è il pezzo necessario perché gli AE già legati a Campobasso o ad altre sedi diventino visibili globalmente anche con le policy RLS esistenti.

4. **Verifica finale**
   - Cercare nel codice ogni residuo di filtro/commento AE per Sede.
   - Verificare che le query AE non contengano `.eq('ufficio_id', ...)` o logiche equivalenti.
   - Aggiornare la release/versione solo se serve forzare il refresh del bundle dopo la modifica.