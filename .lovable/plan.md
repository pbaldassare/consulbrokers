

## Piano: Ridisegnare la Dashboard Admin con KPI operativi

### Cosa rimuovere
- KPI: Utenti Attivi, Sinistri Aperti, Anomalie Critiche
- Grafici: Distribuzione Polizze per Ramo (pie), Andamento Raccolta Premi (bar)

### Cosa mostrare

**Riga 1 — KPI principali (4 card):**
- **Rinnovi del Mese**: count titoli con `data_scadenza` nel mese corrente + totale premio lordo (€89.951)
- **Rinnovi di Oggi**: count titoli con `data_scadenza = oggi` + totale premio lordo (€2.000)
- **Incassi Ieri**: count titoli con `data_messa_cassa = ieri` + totale premio lordo (€3.421)
- **Incassi del Mese**: count titoli incassati nel mese + totale premio lordo (€3.421)

**Riga 2 — Totali (4 card KPI colorate):**
- **Polizze Attive**: 308 in portafoglio
- **Portafoglio Totale**: €3.221.273 (somma premio lordo polizze attive)
- **Raccolta Premi Anno**: somma premi incassati anno corrente
- **Nuovi Clienti Mese**: count clienti creati nel mese

**Sotto**: Attività Recenti (resta com'è)

### File coinvolti
- **Modifica**: `src/hooks/useDashboardData.ts` — sostituire le query admin con rinnovi/incassi
- **Modifica**: `src/pages/Dashboard.tsx` — nuove card AdminDashboard, rimuovere grafici

