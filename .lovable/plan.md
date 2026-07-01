## Causa
`src/pages/ClienteDetail.tsx` riga 1328 renderizza `<TipoFilterSegmented ... />` ma manca l'import → `ReferenceError: TipoFilterSegmented is not defined` → crash dell'Error Boundary "Archivi" quando si apre il tab Polizze del cliente.

Il componente esiste già in `src/components/polizze/TipoFilterSegmented.tsx` con export corretto, ed è utilizzato senza problemi nelle pagine Portafoglio.

## Fix
Aggiungere una sola riga di import in `src/pages/ClienteDetail.tsx`, accanto agli altri import di `@/components/polizze/...`:

```ts
import { TipoFilterSegmented } from "@/components/polizze/TipoFilterSegmented";
```

Nessun'altra modifica: la prop API usata (`value`, `onChange`, `withGarantiti`, `counts`) combacia con la firma del componente.

## Verifica
- Ricarica `/archivi/clienti/:id?tab=polizze` — la scheda deve renderizzarsi senza Error Boundary.
- Il filtro segmentato Polizze/Quietanze/Garantiti deve essere visibile e cliccabile.
