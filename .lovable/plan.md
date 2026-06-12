## Aggiornamento Tour Guidato Portale Cliente

### 1. Aggiungere step per Assistente Polizze
Inserire nuovi step nel tour `CLIENTE_TOUR_STEPS` (`src/components/tour/AppTourContext.tsx`):
- **Sidebar "Assistente Polizze"** (selettore `cl-nav-assistente`): introduzione alla nuova feature AI.
- **Pagina Assistente** (`/cliente/assistente`, selettore `cl-assist-page`): spiegazione della chat AI che interroga tutte le polizze.
- **Suggerimenti rapidi** (selettore `cl-assist-suggerimenti`): mostra i prompt suggeriti (coperture, sinistri, scadenze).
- **Badge polizze indicizzate** (selettore `cl-assist-stats`): spiega che indica quante polizze + CGA l'AI sta consultando.
- **Citazioni fonti**: step che evidenzia come ogni risposta cita la polizza di origine `[Prodotto · n° · Compagnia]`.

Aggiungere i corrispondenti attributi `data-tour="cl-nav-assistente"`, `cl-assist-page`, `cl-assist-suggerimenti`, `cl-assist-stats` rispettivamente in `ClienteLayout.tsx` e `ClienteAssistente.tsx`.

### 2. Disattivare avvio automatico
In `src/components/tour/TourLauncher.tsx`:
- Rimuovere l'`useEffect` che invoca `startTour()` dopo 1.2s al primo accesso.
- Il tour parte **solo** cliccando il bottone "Tour guidato" in basso a destra.
- Mantenere `hasSeenClienteTour` per eventuale UI futura, ma non usarlo come trigger automatico.

### 3. Popup di conferma all'avvio
Aggiungere un `AlertDialog` (shadcn) in `TourLauncher.tsx`:
- Click sul bottone "Tour guidato" → apre dialog di conferma con:
  - Titolo: "Avvia tour guidato?"
  - Descrizione: spiega cosa farà il tour (~25 step, naviga tra le sezioni, ~3 minuti).
  - Pulsanti: **"Annulla"** (chiude) / **"Avvia tour"** (chiama `startTour()` e chiude).
- Stato locale `showConfirm` per gestire apertura/chiusura.

### File da modificare
- `src/components/tour/AppTourContext.tsx` — aggiungere step Assistente Polizze nell'array.
- `src/components/tour/TourLauncher.tsx` — rimuovere auto-start, aggiungere AlertDialog di conferma.
- `src/components/ClienteLayout.tsx` — aggiungere `data-tour="cl-nav-assistente"` sulla voce sidebar.
- `src/pages/cliente/ClienteAssistente.tsx` — aggiungere selettori `cl-assist-page`, `cl-assist-suggerimenti`, `cl-assist-stats`.

Nessuna modifica al backend, alle edge functions o allo schema DB.
