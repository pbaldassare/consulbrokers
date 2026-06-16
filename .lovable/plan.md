
## Ampliamento PDF CBnet — da 12 a ~17 pagine

**Output**: `/mnt/documents/cbnet-presentazione-v2.pdf` (nuova versione, mantengo l'originale come baseline).
**Stile invariato**: Executive scuro — navy `#0B1230`, ice `#CADCFC`, accent corallo `#F96167`.
**Taglio**: non più solo PA. Cover e claim riposizionati per **broker, intermediari, enti pubblici e aziende clienti**. Footer dedicato resta personalizzabile (`Preparato per: protocollo@comune.it`).

### Nuova struttura (17 pagine)

| # | Titolo | Note |
|---|---|---|
| 1 | **Cover** — "CBnet — La piattaforma assicurativa intelligente" | sottotitolo multi-audience, footer personalizzato |
| 2 | **Manifesto** — chi siamo, per chi (Broker / PA / Aziende / Clienti finali) | **NUOVA** |
| 3 | Dashboard & KPI piattaforma | screenshot `/` |
| 4 | **AI #1** — Assistente CFO conversazionale | `/ai-assistant` |
| 5 | **AI #2** — Riconciliazione bancaria (Gemini 2.5) | `/contabilita/ricongiungimento-bancario` |
| 6 | **AI #3** — Import provvigioni da PDF | flusso AI commission |
| 7 | **AI #4** — Ricerca bandi pubblici (Browser-Use) | `/bandi-pubblici` |
| 8 | **AI Commerciale** — analisi portafoglio, cross/up-selling, scadenze a rischio, churn | **NUOVA** — focus opportunità di business |
| 9 | **Efficienza operativa** — quanto tempo recupera ogni ruolo (Specialist, CFO, AE, Produttore): tabella "Prima / Dopo" in ore/mese | **NUOVA** — taglio commerciale |
| 10 | Sinistri — Wizard apertura | screenshot già acquisito |
| 11 | Sinistri — Dashboard, eventi, checklist | `/sinistri` |
| 12 | Sinistri — Scadenze, prescrizioni, SIR | `/sinistri/.../scadenze` |
| 13 | Portafoglio polizze (Attive / Carico / Storico) | `/portafoglio/attive` |
| 14 | Contabilità & Estratti Conto | `/contabilita/ec-clienti-contab` |
| 15 | **Sicurezza informatica — architettura** | **NUOVA**: hosting EU (Supabase/Postgres), TLS 1.3, cifratura at-rest, backup PITR, audit trail immutabile, GDPR, segregazione dati per sede via RLS |
| 16 | **Sicurezza — i 6 livelli di accesso (L1→L6)** | **NUOVA**: piramide grafica con Admin / CFO / Sede / Manager / Produttore / Cliente-Prospect, descrizione visibilità e permessi (presa da `src/lib/userLevels.ts` e `AuthContext`) |
| 17 | Portale Cliente PWA + chiusura "perché CBnet" | `/cliente` |

### Contenuti delle 5 slide nuove (sintesi)

**Slide 2 — Manifesto multi-audience**
4 colonne icone: Broker (gestione 360°) · Enti Pubblici (trasparenza, audit, bandi) · Aziende (portale, sinistri, scadenze) · Clienti finali (PWA, polizze sempre in tasca).

**Slide 8 — AI Commerciale & Opportunità di business**
- Segmentazione automatica portafoglio (alto valore / a rischio churn / dormienti)
- Scadenze a 90gg con priorità AI per produttore
- Cross-selling: polizze suggerite per cluster cliente
- Analisi marginalità per ramo / compagnia / sede
- KPI esempio: "+12-18% retention", "+8% premi medi su rinnovo", "-40% tempo preparazione rinnovo"

**Slide 9 — Efficienza dipendenti (Prima / Dopo)**
Tabella stilizzata con ore/mese risparmiate per ruolo:
- Specialist back-office: riconciliazione banca 40h → 6h
- CFO: chiusura mensile 24h → 8h
- Account Executive: preparazione rinnovi 20h → 5h
- Produttore: ricerca scadenze/CGA 12h → 2h
Totale "ROI tempo" stimato per agenzia da 10 persone.

**Slide 15 — Sicurezza: architettura**
- Hosting EU (Frankfurt), Postgres con RLS sempre attivo
- TLS 1.3 in transito, AES-256 at-rest, backup Point-in-Time 7gg
- Audit trail immutabile su titoli/clienti/sinistri/trattative/compagnie (trigger DB)
- GDPR: privacy_consensi storicizzati, diritto oblio, log accessi
- Edge Functions isolate, secrets fuori dal client, MFA-ready

**Slide 16 — I 6 livelli di accesso**
Piramide grafica:
- L1 Admin — visibilità totale, configurazione sistema
- L2 CFO — tutte le sedi, contabilità/provvigioni
- L3 Sede / Specialist — propria sede (RLS)
- L4 Manager — propri produttori
- L5 Produttore / Corrispondente — solo i propri clienti
- L6 Cliente / Prospect — portale PWA read-only

Ogni livello: badge colorato, 1 riga "vede", 1 riga "può fare". Fonte dati: `src/lib/userLevels.ts`.

### Esecuzione tecnica

1. **Riuso screenshot**: tengo le 11 immagini già catturate in `/tmp/cbnet-pdf/shots/`. Per la slide 8 (AI commerciale) e 9 (efficienza) niente screenshot — uso grafica vettoriale ReportLab (icone + tabelle stilizzate) per non inventare schermate che non esistono.
2. **Slide 15-16 sicurezza**: diagrammi puramente vettoriali (no screenshot reali, sono concetti architetturali).
3. **Script aggiornato** `/tmp/cbnet-pdf/build_pdf_v2.py` — estende il builder esistente con 5 funzioni `draw_slide_*` nuove e riordina l'indice.
4. **QA**: `pdftoppm -jpeg -r 150` su tutte le 17 pagine, controllo overflow/contrasto/ordine, poi consegna con `<presentation-artifact>`.

### Cosa NON faccio
- Non invento numeri fiscali o screenshot non esistenti — i KPI di efficienza sono **stime dichiarate come tali** ("stima indicativa"), non spacciate per dati reali.
- Non tocco il codice dell'app.
- Non rimuovo le 12 slide originali: le riorganizzo e ne aggiungo 5.

Confermi e procedo? Se vuoi che aggiunga/tolga una di queste 5 nuove slide dimmelo ora.
