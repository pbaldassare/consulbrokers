

## Piano: Fix perdita focus nei campi input del dialog Compagnia

### Problema
Il componente `Field` e definito come funzione **dentro** `CompagniaFormDialog` (riga 232). Ad ogni digitazione, lo state cambia, il componente ri-renderizza, React crea una **nuova definizione** di `Field`, e quindi smonta e rimonta tutti gli input — causando la perdita del cursore.

### Intervento

**File: `src/pages/CompagnieList.tsx`**

1. **Estrarre `Field` fuori da `CompagniaFormDialog`** — trasformarlo in un componente standalone che riceve `form` e `setField` come props, oppure sostituirlo con JSX inline diretto (Input + Label) senza creare un sotto-componente ad ogni render.

L'approccio piu semplice: sostituire ogni uso di `<Field label="..." field="..." />` con il JSX diretto gia presente nel componente (div + Label + Input), eliminando la definizione inline di `Field`.

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| File modificato | `src/pages/CompagnieList.tsx` |
| Causa root | Componente `Field` definito dentro il render di `CompagniaFormDialog` |
| Fix | Estrarre `Field` come componente esterno al di fuori di `CompagniaFormDialog`, passando `form` e `onChange` come props |

