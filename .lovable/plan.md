

## Pulizia warning console su `/portafoglio/carico` (e in tutta l'app)

### Problema rilevato
Nella console del Carico del Mese ci sono 2 warning React rumorosi (nessun errore bloccante, ma sporcano i log e tradiscono un anti-pattern):

```
Warning: Function components cannot be given refs.
Did you mean to use React.forwardRef()?
  at Badge (src/components/ui/badge.tsx)
  at ServerPagination (src/components/ServerPagination.tsx)
```

Causa: entrambi i componenti sono dichiarati come **plain function components** (`function Badge(...)`, `export default function ServerPagination(...)`), ma React 18 in dev tenta di passare loro un `ref` (innescato dal contesto delle Table di shadcn / Radix Slot a monte). Senza `forwardRef`, React stampa il warning per ogni render → ne escono decine ad ogni paginazione.

### Cosa modifico

**1. `src/components/ui/badge.tsx`** — converto `Badge` in `React.forwardRef<HTMLDivElement, BadgeProps>`. È una modifica drop-in: stessa API, stesso markup (`<div>`), nessun breaking change. Allineato al pattern già usato dagli altri primitive shadcn nel progetto (Card, Button, ecc.).

**2. `src/components/ServerPagination.tsx`** — converto in `React.forwardRef<HTMLDivElement, ServerPaginationProps>` e attacco il ref al `<div>` wrapper esterno. Mantengo `export default` (così tutti gli import esistenti continuano a funzionare).

### Cosa NON tocco
- `PortafoglioCaricoPage.tsx`: nessuna modifica — la fix risolve a monte.
- Logica dei dati, query, filtri, paginazione: invariati.
- Schema DB, edge function, RLS: invariati.
- Tutte le altre pagine che usano `Badge` o `ServerPagination` (decine): beneficiano automaticamente della stessa fix, niente regressioni perché l'API esterna resta identica.

### Verifica
1. Apri `/portafoglio/carico` → la console non mostra più warning "Function components cannot be given refs".
2. Cambia pagina nella tabella, applica filtri, fai "Messa a Cassa" su un titolo: tutto continua a funzionare come prima.
3. Spot-check su altre pagine con badge/paginazione (`/clienti`, `/portafoglio/attive`, `/storico-gare`): nessuna regressione visiva.

