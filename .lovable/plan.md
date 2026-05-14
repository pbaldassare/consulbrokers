Obiettivo: eliminare in modo permanente la ricomparsa delle vecchie pagine/voci come Cont. Generale, FatturaPA, Fornitori, Banca Import e Rimessa Premi, sia dal codice sia da eventuali bundle/cache vecchi.

Piano di intervento:

1. Pulizia navigazione e rotte legacy
- Rimuovere le rotte ancora attive `/rimessa-premi` e `/rimessa-premi/:id` da `src/routes/contabilita.tsx`.
- Eliminare gli import collegati a `RimessaList` e `RimessaDetail`.
- Aggiornare i redirect/riferimenti interni residui che puntano a `/rimessa-premi`, sostituendoli con il nuovo storico corretto (`/contabilita/storico-rimesse`) o con la pagina contabile coerente.

2. Rimozione riferimenti UI residui
- Aggiornare `PageBreadcrumb` per non mostrare più “Rimessa Premi”.
- Aggiornare `SitemapPage` per rimuovere descrizioni e voci legacy non più accessibili.
- Verificare che in `AppSidebar` restino solo le voci contabili attuali: Cruscotto, Incassi e Coperture, E/C Clienti, E/C Agenzie, Agenzie in Pagamento, Storici, Produttori, Stampa Sospesi.

3. Blocco anti-cache più robusto
- Rafforzare il sistema `versionCheck` per intercettare bundle vecchi anche quando `VITE_APP_VERSION` è `dev` o quando il dev server serve una versione non allineata.
- Forzare una pulizia client più aggressiva di service worker, cache storage e storage tecnico non Supabase.
- Aggiungere un “legacy route guard” lato frontend: se qualcuno arriva a una rotta vecchia rimasta in cronologia/browser/cache, viene mandato automaticamente alla pagina nuova corretta invece di vedere UI obsoleta.

4. Verifica finale
- Cercare di nuovo nel codice le stringhe legacy: `Cont. Generale`, `FatturaPA`, `Fornitori`, `Banca Import`, `Rimessa Premi`, `/rimessa-premi`.
- Controllare la preview dopo refresh/cache busting e confermare che le vecchie voci non compaiano più.

Nota tecnica: non toccherò tabelle o dati Supabase; è una correzione frontend/navigazione/cache.