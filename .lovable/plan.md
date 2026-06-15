## PDF presentazione CBnet per Enti Pubblici — 12 pagine

**Stile**: Executive scuro (navy `#1E2761`, ice blue `#CADCFC`, bianco, accent corallo `#F96167`).
**Output**: `/mnt/documents/cbnet-presentazione-enti-pubblici.pdf`, formato landscape 16:9, ~12 pagine.

### Nota su `protocollo@comune.it`
Non mi hai dato la password e non l'ho da nessuna parte. **Userò la sessione admin già preconfigurata nel sandbox** per fare gli screenshot della piattaforma (i dati visibili sono reali, includono già "Comune di Varese" come ente di esempio). Se poi vuoi il PDF con l'header personalizzato "Preparato per: Comune – utente protocollo@comune.it", lo aggiungo come testo nel footer di copertina senza bisogno di loggarmi davvero.

### Indice pagine

| # | Titolo | Screenshot |
|---|---|---|
| 1 | **Cover** — "CBnet: gestione assicurativa intelligente per la Pubblica Amministrazione" | logo CBnet su sfondo navy + sottotitolo + footer "Preparato per: Comune" |
| 2 | **La piattaforma in sintesi** — KPI, ruoli, sicurezza GDPR | Dashboard `/` (Utenti Attivi, Polizze, Sinistri, Raccolta Premi) |
| 3 | **AI #1 — Assistente CFO conversazionale** | `/ai-assistant` (chat con esempi di domande su flotte/scadenze) |
| 4 | **AI #2 — Riconciliazione bancaria automatica** (Gemini 2.5 Flash) | `/contabilita/ricongiungimento-bancario` |
| 5 | **AI #3 — Import provvigioni da PDF** | flusso AI commission import in Compagnie/Provvigioni |
| 6 | **AI #4 — Ricerca bandi pubblici con Browser-Use** | `/bandi-pubblici` |
| 7 | **Sinistri — Apertura guidata (wizard)** | screenshot già fornito dall'utente (`Apri nuovo sinistro`) |
| 8 | **Sinistri — Dashboard, eventi, checklist** | `/sinistri` + `/sinistri/:id` |
| 9 | **Sinistri — Scadenze, prescrizioni, report SIR** | `/sinistri/.../prescrizioni` o `/scadenze` |
| 10 | **Portafoglio polizze — Attive / Carico / Storico** | `/portafoglio/attive` |
| 11 | **Contabilità & Estratti Conto** | `/contabilita/ec-clienti-contab` |
| 12 | **Portale Cliente PWA + sintesi vantaggi** | `/cliente` (vista cliente read-only) + bullet finali |

Ogni pagina contiene: titolo grande (40pt), sottotitolo (16pt corallo), 2-3 bullet di valore per un ente pubblico (trasparenza, audit trail, RLS, accessibilità), screenshot incorniciato con drop shadow.

### Come lo produco (tecnico)

1. **Screenshot via Playwright** (sessione admin pre-minted), viewport 1440×900, headless Chromium. Script in `/tmp/cbnet-pdf/capture.py`, output in `/tmp/cbnet-pdf/shots/01..12.png`. Per ogni rotta: navigo, attendo `networkidle`, screenshot. Per la pag. 7 riuso direttamente l'immagine che mi hai allegato (più pulita).
2. **QA visivo**: apro le 12 png e verifico che la pagina sia caricata (no skeleton, no 404, no banner "Aggiorna ora"). Se uno screenshot è vuoto, ri-navigo con wait più lungo.
3. **PDF con ReportLab** (`/tmp/cbnet-pdf/build_pdf.py`): landscape A4, sfondo navy, layout split-screen (testo sinistra 40%, screenshot destra 60% con angoli arrotondati), header con numero pagina, footer con dominio + data.
4. **QA del PDF**: converto in jpg con `pdftoppm` e ispeziono tutte le 12 pagine — controllo overflow testi, screenshot tagliati, contrasto, ordine corretto.
5. **Consegna** con `<presentation-artifact>` su `/mnt/documents/cbnet-presentazione-enti-pubblici.pdf`.

### Cosa NON faccio
- Nessuna modifica al codice dell'app.
- Nessun login con credenziali che non ho — non invento password.
- Nessun dato finto inventato: i numeri sono quelli reali della dashboard.

Confermi e procedo? Se vuoi che includa/escluda una pagina specifica dimmelo prima così non rifaccio gli screenshot due volte.
