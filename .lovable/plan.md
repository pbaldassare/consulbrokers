# Tour guidato + Info tooltip — aggiornamento

Obiettivo: aggiornare il tour del portale cliente con le nuove feature (export chat PDF, nuovo layout Documentazione Ente a tab, filtri avanzati Sinistri, Assistente AI) e aggiungere icone **(i)** con tooltip esplicativo sui punti chiave delle card per renderli auto-spiegati anche fuori dal tour.

## 1. Tour guidato (`src/components/tour/AppTourContext.tsx`)

Estensione di `CLIENTE_TOUR_STEPS` con nuovi step ancorati alle feature recenti. Aggiunta dei `data-tour` mancanti nelle pagine corrispondenti.

**Nuovi step aggiunti / riscritti:**

- **Polizze** — nuovo step su KPI strip (`cl-pol-kpi`), filtri avanzati (`cl-pol-filters`) e ricerca full-text estesa.
- **Sinistri** — step su filtri multipli (stato, garanzia, polizza, città, intervallo date), export selezione/tutti, badge stato colorati.
- **Documentazione Ente** (rifatta) — step dedicati ai 3 tab:
  - `cl-doc-tab-polizza`: "Per Polizza — accordion con documenti raggruppati per polizza e sotto-tipo (CGA, Polizza firmata, Quietanze, Appendici…)"
  - `cl-doc-tab-ente`: "Ente — documenti generali non legati a una polizza"
  - `cl-doc-tab-tutti`: "Tutti — vista zebrata completa"
  - `cl-doc-kpi`, `cl-doc-filters` (filtri per tipo doc e polizza)
- **Chat / Comunicazioni** — nuovi step su:
  - `cl-chat-new`: "Apri una nuova conversazione legata a polizza, sinistro o argomento libero"
  - `cl-chat-search`: ricerca tra le conversazioni
  - `cl-chat-export`: **NUOVO** "Esporta in PDF — la conversazione viene scaricata con header brandizzato, partecipanti, bolle alternate, timestamp e log attività"
  - `cl-chat-context`: header contestuale (mostra polizza/sinistro collegato)
- **Assistente AI** — step esistenti mantenuti, aggiunto step sui **suggerimenti contestuali** e sulla **citazione fonte** (già presente, riposizionato).
- **Scadenziario** — step su priorità colorate e filtri 30/60/90 giorni.

**Step rimossi/accorpati:** nessuno; tutti gli step storici restano per compatibilità.

**Totale step:** da 28 → ~36.

## 2. Nuovi `data-tour` da aggiungere nelle pagine

- `src/pages/cliente/ClienteComunicazioni.tsx`: `cl-chat-export` sul bottone "Esporta PDF", `cl-chat-context` sull'header `CanaleContextHeader`.
- `src/pages/cliente/ClienteDocumenti.tsx`: `cl-doc-kpi` sulla KPI strip, `cl-doc-filters` sulla riga filtri, `cl-doc-tab-polizza` / `cl-doc-tab-ente` / `cl-doc-tab-tutti` sui `TabsTrigger`.
- `src/pages/cliente/ClienteSinistri.tsx`: `cl-sin-filters`, `cl-sin-export` (bottone Esporta tutti).
- `src/pages/cliente/ClientePolizze.tsx`: `cl-pol-kpi`, `cl-pol-filters`.

## 3. Icone "i" con tooltip esplicativo

Pattern unico riusabile: piccolo componente `<InfoHint text="..." />` (icona `Info` di lucide, h-3.5 w-3.5, `text-muted-foreground hover:text-primary`) avvolto in shadcn `Tooltip`. File nuovo `src/components/cliente/InfoHint.tsx`.

Inserimento dei tooltip nei punti che meritano spiegazione:

- **ClienteDashboard** — accanto al titolo di ciascuna KPI card (4 card: Polizze attive, Premi totali, Sinistri aperti, Prossime scadenze) con definizione esatta del valore.
- **ClienteDocumenti** — accanto al titolo di ogni gruppo "tipo documento" (CGA, Polizza firmata, Quietanze, Appendici, Privacy, Visure) con descrizione breve di cosa contiene; accanto al titolo dell'accordion polizza con info su stato e ramo.
- **ClienteSinistri** — accanto a "Riserva" e "Liquidato" nell'header tabella per spiegare i due importi; accanto al badge stato.
- **ClientePolizze** — accanto a "Premio", "Frazionamento" e "Scadenza" sulle card.
- **ClienteScadenze** — accanto al badge "giorni mancanti".
- **ClienteAssistente** — accanto al badge "Polizze indicizzate" (es. "L'AI consulta queste polizze + le CGA approvate").
- **ClienteComunicazioni** — accanto al bottone Esporta PDF e accanto all'header contestuale.

I testi sono brevi (max 2 righe), in italiano, senza emoji.

## 4. Note tecniche

- Nessuna modifica a backend/RLS/edge functions.
- Lo `STORAGE_KEY` del tour NON viene cambiato (no flag versione): chi vuole rivedere il tour usa il pulsante ✨ in basso a destra. Opzionale: introdurre `cbnet_cliente_tour_done_v2` per ri-auto-aprire il tour una sola volta agli utenti esistenti — **da confermare**.
- `Tooltip` shadcn è già usato altrove; nessuna nuova dipendenza.
- I `data-tour` aggiunti sono no-op senza tour attivo: zero impatto runtime.

## File toccati

- `src/components/tour/AppTourContext.tsx` (estensione step)
- `src/components/cliente/InfoHint.tsx` (nuovo)
- `src/pages/cliente/ClienteDashboard.tsx`
- `src/pages/cliente/ClientePolizze.tsx`
- `src/pages/cliente/ClienteSinistri.tsx`
- `src/pages/cliente/ClienteScadenze.tsx`
- `src/pages/cliente/ClienteDocumenti.tsx`
- `src/pages/cliente/ClienteComunicazioni.tsx`
- `src/pages/cliente/ClienteAssistente.tsx`

## Domanda aperta
Vuoi che il tour si riapra automaticamente una volta sola agli utenti che l'avevano già visto (nuovo storage key `_v2`)? Default proposto: **sì**.
