# Tour guidato Area Clienti — stile Cibarius

Replichiamo il pattern di Cibarius HACCP (spotlight + tooltip + auto-advance) e lo adattiamo al contesto assicurativo CBnet, attraversando tutte le sezioni del portale cliente.

## Componenti nuovi

1. **`src/components/tour/AppTourContext.tsx`** — Provider con stato globale del tour:
   - `isActive`, `currentStep`, `steps`, `startTour()`, `stopTour()`, `nextStep()`, `prevStep()`
   - Tipi `TourStep` con `selector`, `title`, `description`, `page`, `action` (`navigate` | `scroll` | `wait`)
   - Una sola lista `CLIENTE_TOUR_STEPS` (~22 step) che copre Dashboard → Polizze → Scadenziario → Sinistri → Chat → Documentazione Ente → Notifiche → Dati Ente → Info e Contatti
   - Persistenza in `localStorage` (`cbnet_cliente_tour_done`) per auto-start al primo accesso

2. **`src/components/tour/AppTour.tsx`** — Overlay visivo (porting da Cibarius):
   - SVG mask con foro su `getBoundingClientRect()` del target → spotlight scuro (`bg-black/65`)
   - Bordo animato `border-primary` con glow `box-shadow: 0 0 24px hsl(var(--primary)/0.25)`
   - Cursore freccia che si muove sul target prima di mostrare il tooltip
   - Tooltip card con: contatore `n/totale`, titolo, descrizione, **barra progresso countdown**, pulsante Pausa/Play, X per chiudere, link "Salta tour"
   - Auto-advance: `max(3500ms, descrizione.length * 35ms)`
   - Click sul tooltip = pausa/riprendi; ricalcolo posizione su `resize`
   - Posizionamento intelligente top/bottom in base allo spazio disponibile
   - Tutto via token semantici (`hsl(var(--primary))`, `bg-card`, `border-border`)

3. **`src/components/tour/TourLauncher.tsx`** — Pulsante flottante in basso a destra (`fixed bottom-4 right-4`) con icona `Sparkles` + tooltip "Tour guidato", visibile solo nelle pagine `/cliente/*`. All'avvio chiama `startTour()`.

## Modifiche

- **`src/App.tsx`** — Avvolgere le route `/cliente/*` con `<TourProvider>` e renderizzare `<AppTour />` + `<TourLauncher />` dentro `ClienteLayout`.
- **`src/components/ClienteLayout.tsx`** — Aggiungere `data-tour="..."` sugli elementi chiave: `cl-logo`, `cl-nav-dashboard`, `cl-nav-polizze`, `cl-nav-scadenziario`, `cl-nav-sinistri`, `cl-nav-chat`, `cl-nav-documenti`, `cl-nav-notifiche`, `cl-nav-dati`, `cl-nav-contatti`, `cl-topbar-bell`, `cl-topbar-user`, `cl-topbar-logout`. Auto-start del tour al primo login (se `localStorage` vuoto).
- **Pagine cliente** — Aggiungere attributi `data-tour` sui blocchi principali (header, KPI, tabella, filtri, pulsante upload):
  - `ClienteDashboard.tsx`: `cl-dash-header`, `cl-dash-kpi`, `cl-dash-prossime`
  - `ClientePolizze.tsx`: `cl-pol-header`, `cl-pol-filtri`, `cl-pol-tabella`
  - `ClienteScadenze.tsx`: `cl-scad-header`, `cl-scad-list`
  - `ClienteSinistri.tsx`: `cl-sin-header`, `cl-sin-nuova`, `cl-sin-list`
  - `ClienteComunicazioni.tsx`: `cl-chat-header`, `cl-chat-canali`, `cl-chat-area`
  - `ClienteDocumenti.tsx`: `cl-doc-header`, `cl-doc-filtri`, `cl-doc-upload`, `cl-doc-list`
  - `ClienteNotifiche.tsx`: `cl-notif-header`, `cl-notif-list`
  - `ClienteAnagrafica.tsx`: `cl-anag-header`, `cl-anag-form`
  - `ClienteUfficio.tsx`: `cl-uff-header`, `cl-uff-contatti`

## Esempio di step (tono assicurativo, friendly)

```
{ selector: "cl-dash-kpi", title: "Le tue polizze a colpo d'occhio 📊",
  description: "KPI in tempo reale: polizze attive, premio annuo e prossime scadenze. Tutto sincronizzato con la tua agenzia.",
  page: "/cliente" }

{ selector: "cl-nav-sinistri", title: "Apri un sinistro in 2 minuti 🚨",
  description: "Da qui denunci un nuovo sinistro, alleghi foto e documenti e segui ogni aggiornamento dal tuo perito.",
  page: "/cliente", action: { type: "navigate", target: "/cliente/sinistri", delay: 500 } }

{ selector: "cl-doc-upload", title: "Carica documenti in sicurezza 🔐",
  description: "Trascina qui PDF e immagini: vengono archiviati nel bucket privato del tuo ente e visti solo da te e dall'agenzia.",
  page: "/cliente/documenti" }
```

## Non incluso (out of scope)

- Backend / migrazioni DB (la "vista" del tour è solo client-side, persistenza in `localStorage`)
- Tour separato per ruoli admin / specialist (estendibile in futuro)
- Traduzioni multi-lingua
