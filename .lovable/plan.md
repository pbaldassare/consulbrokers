

## Piano: Card "Rinnovi del Mese" → Carico del Mese

### Cosa cambia
La card "Rinnovi del Mese" (= quietanzamento del mese) deve puntare al **Carico del Mese** invece che a `/portafoglio/rinnovi`. Inoltre il valore mostrato deve coincidere esattamente con quello della pagina `/portafoglio/carico` (vista `v_carico_mese`).

### Modifiche

**1. `src/pages/Dashboard.tsx` (riga 151)**
- Cambio `onClick` della card "Rinnovi del Mese": `navigate("/portafoglio/rinnovi")` → `navigate("/portafoglio/carico")`
- Stesso cambio per "Rinnovi di Oggi" (riga 152) → punta a `/portafoglio/carico` (è il sottoinsieme con scadenza odierna)

**2. `src/hooks/useDashboardData.ts`**
- Cambio la sorgente di `rinnoviMese` e `rinnoviOggi` da `v_portafoglio_titoli` a **`v_carico_mese`** (la stessa vista usata dalla pagina Carico del Mese), così il numero in dashboard combacia al 100% con quello che l'utente vede cliccando.
- Filtro:
  - `rinnoviMese`: tutti i record di `v_carico_mese` con `data_scadenza` nel mese corrente
  - `rinnoviOggi`: stesso filtro ristretto a `data_scadenza = oggi`
- Uso `count: "exact"` e somma `premio_lordo` per il sub-totale.

### File coinvolti
- ✏️ `src/pages/Dashboard.tsx` — redirect card al Carico del Mese
- ✏️ `src/hooks/useDashboardData.ts` — sorgente dati allineata a `v_carico_mese`

