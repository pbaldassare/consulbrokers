

## Piano: Forzare il refresh della pagina con meta tag no-cache e version check

### Problema
Il codice Dashboard.tsx è già aggiornato, ma il browser dell'utente cacha `index.html` stesso (HTTP cache del browser/CDN), quindi continua a caricare i vecchi bundle JS. Lo script di pulizia SW in main.tsx funziona solo DOPO che il nuovo JS viene caricato — ma se index.html è cachato, carica ancora i vecchi script.

### Soluzione

**1. Aggiungere meta tag no-cache in `index.html`**
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```
Questo dice al browser di non cachare mai index.html.

**2. Aggiungere un meccanismo di version check in `main.tsx`**
- Definire una costante `APP_VERSION` (timestamp del build)
- All'avvio, confrontare con `localStorage.getItem("app_version")`
- Se diverso: salvare la nuova versione e forzare `location.reload()` per scaricare i nuovi asset
- Questo garantisce che anche se index.html è servito da cache CDN vecchia, al prossimo deploy con nuova versione il browser fa un hard reload

**3. Pulizia aggiuntiva: rimuovere componenti orfani da Dashboard.tsx**
- `PieChartCard`, `BarChartCard`, `PlaceholderChart`, `PlaceholderList` non sono più usati dall'AdminDashboard
- Rimuovere import di Recharts non necessari per l'admin (ma servono ancora per UfficioDashboard e ProduttoreDashboard)
- Pulizia degli import inutilizzati

### File coinvolti
- **Modifica**: `index.html` — meta tag no-cache
- **Modifica**: `src/main.tsx` — version check con auto-reload
- **Modifica**: `src/pages/Dashboard.tsx` — cleanup import/componenti orfani (opzionale)

