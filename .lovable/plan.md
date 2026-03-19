

## Piano: Card KPI macro + Search nei filtri dropdown

### Cosa faremo

#### 1. Aggiungere card KPI riepilogative in cima a ogni pagina di estrazione

Ogni pagina mostrera 3-4 card colorate (stesso stile `SummaryCard`/`KpiCard` della Dashboard) con i totali calcolati dai dati gia caricati:

| Pagina | Card |
|--------|------|
| **Portafoglio per Cliente** | N. Clienti, N. Polizze, Totale Premi, Totale Incassato |
| **Portafoglio per Compagnia** | N. Compagnie, N. Polizze, Totale Premi, Totale Incassato |
| **Premi e Provvigioni** | Totale Premi, Totale Incassato, Totale Provvigioni, % Media Provvigione |
| **Premi Scoperti e Garantiti** | N. Garantiti, N. Scoperti, Totale Garantito, Totale Scoperto |
| **E/C Clienti** | N. Clienti, Totale Dare, Totale Avere, Saldo Complessivo |

Le card useranno le varianti colore gia definite nella Dashboard (`green`, `blue`, `orange`, `teal`).

#### 2. Aggiungere ricerca nei Select dei filtri (EstrazioniFilters)

Sostituire i `Select` standard di Ufficio, Produttore, Compagnia e Cliente con un pattern **Popover + Command** (Combobox searchable):
- Input di ricerca in cima alla lista
- Filtraggio live delle opzioni
- Stessa UX del componente `Command` gia presente nel progetto (`src/components/ui/command.tsx`)

### File coinvolti

| Azione | File |
|--------|------|
| Modificare | `src/components/estrazioni/EstrazioniFilters.tsx` — Select → Combobox searchable |
| Modificare | `src/pages/estrazioni/PortafoglioPerClientePage.tsx` — aggiungere card KPI |
| Modificare | `src/pages/estrazioni/PortafoglioPerCompagniaPage.tsx` — aggiungere card KPI |
| Modificare | `src/pages/estrazioni/PremiProvvigioniPage.tsx` — aggiungere card KPI |
| Modificare | `src/pages/estrazioni/PremiScopertiGarantitiPage.tsx` — aggiungere card KPI |
| Modificare | `src/pages/estrazioni/ECClientiPage.tsx` — aggiungere card KPI |

