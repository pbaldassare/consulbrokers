## Problema

Cliccando "Genera Precontrattuale" appare 404. La rotta nel router è registrata come `/portafoglio/doc-precontrattuale` (vedi `src/routes/portafoglio.tsx:51`), ma il pulsante naviga a `/doc-precontrattuale`.

## Fix

In `src/pages/ClienteDetail.tsx` riga 1489, cambiare:

```tsx
onClick={() => navigate(`/doc-precontrattuale?clienteId=${id}`)}
```

in:

```tsx
onClick={() => navigate(`/portafoglio/doc-precontrattuale?clienteId=${id}`)}
```

## File toccati

- `src/pages/ClienteDetail.tsx` (1 riga)
- `public/version.json` (bump)
