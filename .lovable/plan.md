## Cambio richiesto

Rimuovere il filtro per Sede nella tendina **Account Executive**: deve mostrare sempre tutti gli AE attivi, indipendentemente dall'`ufficio_id` del cliente/polizza.

## Modifiche

1. **`src/hooks/useAccountExecutivesLookup.ts`**
   - Ignorare il parametro `ufficioId`: una sola query che restituisce tutti gli AE attivi (`tipo='account_executive'`, `attivo=true`).
   - Rimuovere il flag `isFallback` dal tipo di ritorno (mantenuto a `false` per retro-compatibilità) e aggiornare la docstring.

2. **UI che usavano `isFallback`**
   - `src/pages/ClienteDetail.tsx`: rimuovere la nota "Nessun AE collegato alla Sede…".
   - `src/pages/TitoloDetail.tsx`, `src/pages/ImmissionePolizzaPage.tsx`, `src/components/clienti/NuovoClienteDialog.tsx`: verificare che non mostrino più hint legati al fallback.

3. **Memoria progetto**
   - Aggiornare `mem://insurance/account-executive-sede-filter` per riflettere la nuova regola: AE indipendenti dalla Sede.

## Verifica

- Su COMUNE DI AGNONE (Sede Campobasso) la tendina AE elenca tutti gli AE attivi, incluso "Sede Campobasso executive" e gli altri (Tallini, Amato, Baldini, ecc.).
- Stesso comportamento in Immissione/Modifica Polizza e in Nuovo Cliente.