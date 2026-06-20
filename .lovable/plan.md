## Obiettivo
Nella pagina **Carico** (`/portafoglio/carico`) il chip filtro **"Polizze"** non ha senso (il Carico mostra solo quietanze/scadenze): va nascosto.

## Modifiche

1. **`src/components/polizze/TipoFilterSegmented.tsx`**
   - Aggiungere prop opzionale `hidePolizze?: boolean` (default `false`).
   - Se `true`, escludere l'item `polizze` dalla lista renderizzata. Nessun impatto sulle altre pagine (Attive, Storico) che continueranno a vederlo.

2. **`src/pages/PortafoglioCaricoPage.tsx`**
   - Passare `hidePolizze` al `<TipoFilterSegmented ... withRegolazioni hidePolizze />`.
   - All'inizializzazione, se `filtroTipo === "polizze"` (da URL o stato salvato), forzarlo a `"tutti"` per evitare lista vuota.

## Fuori scope
Nessuna modifica a logica dati, KPI o altre pagine portafoglio.