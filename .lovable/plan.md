

## Piano: Calendario Trattative stile Google Calendar

### Obiettivo
Creare una pagina calendario dedicata alle trattative, stile Google Calendar, che aggreghi tutti gli eventi rilevanti (aperture, scadenze, eventi timeline, cambi stato) con filtri avanzati e viste multiple (mese/settimana/giorno).

### Fonti dati
Il calendario aggregherà eventi da 3 tabelle esistenti:
- **trattative** -- `data_apertura`, `data_scadenza`, `data_chiusura`
- **trattativa_eventi** -- `data_evento` / `created_at` (cambi stato, note, appuntamenti)
- **trattativa_scadenze** -- `data_scadenza`, `completata`

### Componenti da creare

#### 1. Pagina `CalendarioTrattativePage.tsx`
- Vista principale con header filtri + calendario
- Filtri: tipo evento (apertura/scadenza/nota/cambio stato), stato trattativa, priorita, ufficio, compagnia
- Toggle vista: Mese / Settimana / Giorno (default: mese)
- Query che carica tutte le trattative + eventi + scadenze del periodo visibile

#### 2. Componente `CalendarView.tsx`
- Griglia calendario stile Google Calendar
- Celle giornaliere con eventi colorati per tipo:
  - Verde: aperture trattative
  - Blu: scadenze/appuntamenti
  - Arancione: cambi stato
  - Rosso: scadenze scadute non completate
  - Grigio: note/eventi generici
- Click su evento apre il dettaglio trattativa (riutilizza `TrattativaDetailDialog`)
- Click su giorno vuoto permette di aggiungere evento/scadenza
- Navigazione mese precedente/successivo con frecce
- "Oggi" button per tornare al giorno corrente

#### 3. Componente `CalendarEventCard.tsx`
- Mini card per ogni evento nella cella
- Mostra: orario (se presente), titolo, badge priorita
- Tooltip con dettagli extra al hover

#### 4. Componente `CalendarDayView.tsx` / `CalendarWeekView.tsx`
- Vista giornaliera con timeline verticale (ore)
- Vista settimanale con 7 colonne

### Filtri disponibili
- **Tipo evento**: Aperture, Scadenze, Cambi stato, Note, Appuntamenti (multi-select)
- **Stato trattativa**: tutti gli 8 stati (multi-select)
- **Priorita**: urgente, alta, media, bassa
- **Ufficio**: dropdown uffici
- **Compagnia**: dropdown compagnie

### Routing
- Nuova rotta `/trattative/calendario` in `src/routes/archivi.tsx`
- Link nel sidebar sotto Trattative o tab nella pagina trattative

### File coinvolti

| File | Azione |
|------|--------|
| `src/pages/CalendarioTrattativePage.tsx` | Nuovo -- pagina principale |
| `src/components/calendario/CalendarMonthView.tsx` | Nuovo -- griglia mese |
| `src/components/calendario/CalendarWeekView.tsx` | Nuovo -- vista settimana |
| `src/components/calendario/CalendarDayView.tsx` | Nuovo -- vista giorno |
| `src/components/calendario/CalendarEventCard.tsx` | Nuovo -- card evento |
| `src/components/calendario/CalendarFilters.tsx` | Nuovo -- barra filtri |
| `src/routes/archivi.tsx` | Aggiunta rotta `/trattative/calendario` |
| `src/components/AppSidebar.tsx` | Link "Calendario" sotto Trattative |

### Dettagli tecnici
- Uso di `date-fns` (gia installato) per calcolo griglia, navigazione, formattazione
- Nessuna libreria calendario esterna -- costruito custom per massima flessibilita
- Query con filtro date per caricare solo il periodo visibile (performance)
- Colori evento gestiti con Tailwind classes
- Responsive: su mobile vista giorno come default

