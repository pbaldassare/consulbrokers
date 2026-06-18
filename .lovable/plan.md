## Fix: ricerca cliente nello Step 1 wizard sinistri

### Causa

Il `SearchableSelect` interno usa `cmdk` con `shouldFilter={true}` hardcoded:
i risultati che arrivano dal server vengono **ri-filtrati lato client** da cmdk
contro la stringa digitata. Quando i dati arrivano in asincrono dopo il debounce
(o quando l'utente cancella/cambia rapidamente il testo) cmdk può non far
matchare nulla e mostra "Nessun risultato" anche se `clientiList` è popolato.

Per le ricerche **server-side** (come quella su `clienti`) il filtro client di
cmdk va disabilitato: l'autorità di cosa mostrare deve essere il server.

### Modifiche

1) **`src/components/SearchableSelect.tsx`**
   - Nuova prop opzionale `serverSideSearch?: boolean` (default `false`,
     retro-compatibile).
   - Quando `true`: `<Command shouldFilter={false}>` e `<CommandEmpty>`
     personalizzato in base allo stato:
     - se `searchValue` vuoto → "Digita per cercare…"
     - se `searchValue` con almeno 2 char e `options.length === 0` → `emptyText`

2) **`src/pages/SinistroAperturaWizardPage.tsx`**
   - `<SearchableSelect>` del cliente: passo `serverSideSearch`.
   - La ricerca cliente parte già da **1 carattere** (oggi parte da 1, lascio
     così) ma normalizzo `q` con `replaceAll(',', ' ')` per evitare che una
     virgola digitata rompa la sintassi `.or(...)` di PostgREST.
   - Aggiungo `order('cognome', { ascending: true, nullsFirst: false })` per
     una lista deterministica.
   - Mostro un piccolo indicatore "Ricerca in corso…" quando il debounce è
     attivo (state `clientiLoading`).

### Cosa NON cambia

- Nessuna modifica a schema DB / RLS (i dati ci sono: query verificata).
- Nessun impatto sugli altri usi di `SearchableSelect`: senza la nuova prop
  il comportamento è identico a oggi.
- Nessuna modifica agli step 2-5 del wizard.