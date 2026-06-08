# Freccia indietro su Polizza/Quietanza

## Problema
In `TitoloDetail` la freccia "indietro" nell'header riporta sempre a **`/portafoglio/carico`** (Carico del Mese), sia per la polizza madre che per le quietanze figlie. Deve invece riportare alla **scheda Cliente** da cui la polizza è stata aperta.

## Modifica
Un'unica riga in `src/pages/TitoloDetail.tsx` (riga 1444), dove viene passato `onBack` al componente `TitoloHeaderBar`:

```tsx
<TitoloHeaderBar
  t={t}
  onBack={() =>
    t.cliente_anagrafica?.id
      ? navigate(`/archivi/clienti/${t.cliente_anagrafica.id}`)
      : navigate("/portafoglio/carico")
  }
/>
```

## Comportamento risultante
- Polizza con cliente collegato (caso standard, incluso lo screenshot "baldassare paolo") → torna a `/archivi/clienti/:id`.
- Quietanza → stesso componente, stesso `cliente_anagrafica` ereditato → torna al cliente.
- Polizza senza cliente collegato (edge case legacy) → fallback a `/portafoglio/carico` come oggi.

## Fuori scope
- Nessuna modifica al breadcrumb globale ("Torna a Clienti" / "Titoli > Dettaglio") che è gestito separatamente.
- Nessuna modifica alla logica di navigazione di altre pagine (Sinistri, Trattative, ecc.).
