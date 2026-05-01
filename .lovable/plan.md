## Riordino Tab Cliente

Spostare il tab **Anagrafica** in prima posizione (prima di Polizze) nella pagina dettaglio cliente, e impostarlo come tab di default all'apertura.

### Modifiche

**File: `src/pages/ClienteDetail.tsx` (righe 1555-1565)**

- Cambio `<Tabs defaultValue="polizze">` → `<Tabs defaultValue="anagrafica">` così entrando nel cliente si vede subito l'anagrafica.
- Riordino `TabsTrigger`: `anagrafica` come primo, poi `polizze`, poi gli altri invariati (`sinistri`, `relazioni`, `documenti`, `chat`, `timeline`, `trattative`).

Risultato ordine finale:
```text
Anagrafica | Polizze (N) | Sinistri | Persone/Aziende (N) | Documenti | Chat | Log Attività | Trattative
```

**File: `public/version.json`** → bump versione.

### Note
- Solo riordino visivo dei `TabsTrigger`; i `TabsContent` restano dove sono (l'ordine dei content non influisce sulla UI).
- Nessuna modifica a logica, query o componenti figli.