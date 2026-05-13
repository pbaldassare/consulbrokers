## Problema
Nel select "Cliente esistente" di `/portafoglio/immissione` non funziona la ricerca: il `SearchableSelect` mostra l'input "Cerca..." ma filtra solo gli elementi già presenti, mentre la lookup è **server-side** (state `clienteSearch` → `clientiSearchResults`). Lo state `clienteSearch` non viene mai aggiornato dalla digitazione nel popover, quindi la lista resta quella iniziale e l'utente non vede nessun box di ricerca utile.

## Fix

### 1. `src/components/SearchableSelect.tsx` — aggiungere modalità controllata della ricerca
- Nuove props opzionali:
  - `searchValue?: string`
  - `onSearchChange?: (q: string) => void`
  - `searchPlaceholder?: string` (default "Cerca...")
- Se `onSearchChange` è definito:
  - `<CommandInput value={searchValue} onValueChange={onSearchChange} />`
  - `<Command shouldFilter={false}>` per disattivare il filtro client-side e mostrare esattamente le `options` ricevute (server-driven).
- Comportamento attuale invariato quando le props non sono passate.

### 2. `src/pages/ImmissionePolizzaPage.tsx` (riga ~704)
Passare al `SearchableSelect` cliente:
```tsx
searchValue={clienteSearch}
onSearchChange={setClienteSearch}
searchPlaceholder="Cerca per nome, CF o P.IVA…"
```
Nessun'altra modifica.

## Fuori scope
- I select Sede / Produttore / Specialist hanno già lookup statiche con filtro client-side: restano come sono.
- Nessuna modifica DB / RLS.
