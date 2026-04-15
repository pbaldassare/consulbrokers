

## Piano: Rimodellare la Dashboard Admin — rimuovere attività e KPI inutili, aggiungere chat non lette e click sui quadranti

### Cosa rimuovere
- **Attività Recenti** (intero blocco in fondo)
- **Polizze Attive** e **Portafoglio Totale** dalla riga 2
- Codice/componenti inutilizzati: `ActivityList`, import Recharts (già non usati), `PlaceholderChart`, `PlaceholderList`

### Cosa modificare

**Riga 2 — ridotta a 2 card:**
- **Raccolta Premi Anno** → resta, occupa metà riga
- **Nuovi Clienti Mese** → resta, occupa metà riga

**Nuova sezione — Chat Non Risposte:**
- Query `chat_messaggi_interni` per trovare gli ultimi messaggi nei canali dell'utente dove l'ultimo messaggio NON è dell'utente corrente (= non ha risposto)
- Mostrare lista con: nome canale, mittente ultimo messaggio, testo troncato, data/ora
- Click su una riga → `navigate("/chat")` con il canale selezionato

**Click sui quadranti KPI — navigazione:**
| Card | Destinazione |
|------|-------------|
| Rinnovi del Mese | `/portafoglio/rinnovi` |
| Rinnovi di Oggi | `/portafoglio/rinnovi` |
| Incassi Ieri | `/portafoglio/carico` |
| Incassi del Mese | `/portafoglio/carico` |
| Raccolta Premi Anno | `/provvigioni-maturate` |
| Nuovi Clienti Mese | `/clienti` |

### Dettagli tecnici

**File: `src/hooks/useDashboardData.ts`**
- Rimuovere dalla query admin: `polizzeAttive`, `portafoglioTotale`, `attivitaRecenti` e relative fetch
- Aggiungere query per chat non risposte: fetch canali dell'utente → per ogni canale fetch ultimo messaggio → filtrare dove `mittente_id != user.id`
- Nuovo campo in `AdminData`: `chatNonRisposte: { canaleId, canaleNome, mittente, testo, data }[]`

**File: `src/pages/Dashboard.tsx`**
- `SummaryCard` e `KpiCard` ricevono prop `onClick` opzionale → wrappare in `cursor-pointer` + `useNavigate`
- Riga 2: da 4 a 2 colonne (`lg:grid-cols-2`)
- Sostituire `ActivityList` con nuovo componente `ChatNonRisposte` — lista con icona chat, nome canale, ultimo messaggio troncato, click → navigate a `/chat`
- Rimuovere componenti orfani (`PieChartCard`, `BarChartCard`, `PlaceholderChart`, `PlaceholderList`, import Recharts)

