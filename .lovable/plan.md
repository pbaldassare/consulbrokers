Il problema non è più il filtro per Sede: nel DB l’Account Executive di Campobasso esiste ed è attivo, con `ufficio_id = NULL`.

Il problema reale è nella label/search della tendina: la select mostra/cerca solo `cognome + nome` (`Tallini iole`) e ignora `ragione_sociale`, dove c’è il riferimento “Sede Campobasso executive”. Quindi cercando “Campobasso” non lo trovi.

Piano di intervento:

1. Aggiornare `useAccountExecutivesLookup`
   - mantenere la query globale su tutti gli AE attivi
   - includere `ragione_sociale`, `sigla`, `codice` dentro `searchText`
   - mostrare `ragione_sociale` come descrizione sotto il nome, così “Tallini iole” sarà riconoscibile come Campobasso

2. Verificare la select in `ImmissionePolizzaPage`
   - lasciare la lista globale `useAccountExecutivesLookup()` senza parametro Sede
   - assicurare che `SearchableSelect` riceva opzioni con `label`, `description`, `searchText`

3. Forzare aggiornamento bundle
   - aggiornare versione release/version.json per evitare che la preview resti su bundle vecchio

4. Controllo finale
   - verificare che cercando “Campobasso” nella select Account Executive appaia l’AE collegato alla ragione sociale “Sede Campobasso executive”.