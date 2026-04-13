

## Piano: Ristrutturare la sezione Portafoglio con tre viste

### Concetto

La pagina "Ricerca Polizze" attuale (`/portafoglio`) va trasformata in un hub con tre tab/viste basate sulla tabella `titoli`:

1. **Polizze Attive** — `stato = 'attivo' AND garanzia_a >= oggi` (237 polizze)
2. **Carico del Mese** — polizze con `data_scadenza` nel mese corrente, da confermare/rinnovare (13 polizze ad aprile)
3. **Storico** — polizze con `stato IN ('incassato', 'scaduto')` oppure `garanzia_a < oggi` (734+ record)

### Modifiche previste

#### 1. Nuova pagina `PortafoglioPolizzePage.tsx`
- Tre tab: "Polizze Attive", "Carico Mese", "Storico"
- Ogni tab con tabella paginata server-side, filtri (compagnia, ramo, cliente), contatori
- Il "Carico Mese" include un selettore mese/anno e azioni per confermare/rinnovare
- Card riassuntive in alto con conteggi e totale premi per vista

#### 2. Aggiornamento route e sidebar
- La route `/portafoglio` punta alla nuova pagina (rinominare "Ricerca Polizze" in "Portafoglio Polizze" nella sidebar)
- La vecchia `PortafoglioList` (portafoglio_incassi) resta su una route separata se serve, altrimenti viene sostituita

#### 3. Logica di classificazione
Le query usano i campi esistenti nella tabella `titoli`:
- **Attive**: `stato = 'attivo' AND garanzia_a >= CURRENT_DATE`
- **Carico mese**: `data_scadenza BETWEEN primo_giorno_mese AND ultimo_giorno_mese`
- **Storico**: `stato IN ('incassato','scaduto') OR (stato = 'attivo' AND garanzia_a < CURRENT_DATE)`

Nessuna migrazione database necessaria — i campi `garanzia_a`, `data_scadenza` e `stato` esistono già.

### File coinvolti

| File | Azione |
|------|--------|
| `src/pages/PortafoglioPolizzePage.tsx` | Nuova pagina con tre tab |
| `src/routes/portafoglio.tsx` | Aggiornare route `/portafoglio` |
| `src/components/AppSidebar.tsx` | Rinominare "Ricerca Polizze" → "Portafoglio Polizze" |
| `src/pages/SitemapPage.tsx` | Aggiornare etichetta |

