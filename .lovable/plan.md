

## Piano: Upgrade grafico portale cliente + dati simulati + statistiche

### Panoramica
Trasformare il portale cliente da interfaccia basica a dashboard professionale con grafici Recharts, colori, sinistri simulati, dati polizze arricchiti e scadenziario visuale.

---

### Fase 1 — Migrazione SQL: arricchire dati + simulare sinistri

**Aggiornare le 8 polizze** con campi mancanti:
- `data_scadenza`, `durata_da`, `durata_da`, `periodicita`, `premio_netto`, `tasse`, `data_competenza`, `compagnia_id`, `ramo_id`, `descrizione_polizza`
- Aggiungere date di incasso realistiche (2024-2025)

**Inserire 5 sinistri fake** collegati alle polizze del Comune di Varese:
1. Danno acqua — polizza RCT/O — aperto, riserva 15.000
2. Infortunio dipendente — polizza Infortuni — chiuso, liquidato 3.200
3. Furto attrezzature — polizza Kasko — in_lavorazione, riserva 8.500
4. RC Terzi scivolamento — polizza RCT/O — aperto, riserva 22.000
5. Cyber attack — polizza Cyber Risk — in_attesa_documenti, riserva 12.000

Ogni sinistro con: `numero_sinistro`, `tipo_sinistro`, `data_evento`, `data_apertura`, `luogo_sinistro`, `descrizione`, `importo_riserva`, `importo_liquidato`, `costo_preventivato`, `stato`

---

### Fase 2 — Dashboard con grafici e KPI colorati

Riscrivere `ClienteDashboard.tsx`:
- **KPI cards** con icone su sfondo colorato circolare (stile CFO), bordi sinistri colorati:
  - Polizze attive (verde), Premi totali (blu), Sinistri aperti (arancione), Prossime scadenze (rosso)
- **Grafico a torta** (Recharts PieChart): ripartizione premi per ramo/prodotto
- **Grafico a barre** (Recharts BarChart): premi per compagnia
- **Timeline scadenze** prossime (3-4 card con countdown giorni)
- **Mini tabella sinistri** recenti con stato colorato

---

### Fase 3 — Polizze: card arricchite + dettaglio completo

**ClientePolizze.tsx**: card più ricche con:
- Compagnia (fetch join `compagnie.nome`), ramo, periodicità
- Premio lordo in evidenza, data scadenza, data decorrenza
- Icona colorata per ramo
- Badge stato con colori più vivaci

**ClientePolizzaDetail.tsx**: dettaglio completo con:
- Sezione "Dati Polizza" con tutti i campi: compagnia, ramo, decorrenza, scadenza, periodicità, premio netto, tasse, premio lordo
- Sezione "Copertura" con descrizione polizza
- Badge stato grande colorato
- Documenti allegati (invariato)

---

### Fase 4 — Scadenziario visuale

Riscrivere `ClienteScadenze.tsx`:
- **KPI** in cima: scadenze prossimi 30gg (rosso), 60gg (arancione), 90gg (giallo)
- **Lista card** con indicatore visuale giorni mancanti (barra colorata), countdown
- Ordinamento per data scadenza (più vicina prima)
- Badge urgenza: "URGENTE" rosso < 30gg, "IN SCADENZA" arancione < 60gg

---

### Fase 5 — Sinistri migliorati

Aggiornare `ClienteSinistri.tsx`:
- **KPI row**: Totale, Aperti (arancione), Chiusi (verde), Riserve totali (€), Liquidato totale (€)
- **Grafico PieChart**: distribuzione per tipo sinistro
- **Grafico BarChart**: riserve vs liquidato per sinistro
- Tabella con più colonne: importo riserva, importo liquidato

---

### Fase 6 — Sidebar colorata stile brand

Aggiornare `ClienteLayout.tsx`:
- Sidebar con gradiente teal (hsl(199,58%,18%) → hsl(199,58%,26%)) come la sidebar admin
- Logo bianco, testi nav bianchi/semi-trasparenti
- Voce attiva con sfondo bianco semi-trasparente
- Footer sidebar con nome utente in bianco

---

### File coinvolti

| File | Azione |
|------|--------|
| Migrazione SQL | UPDATE 8 polizze + INSERT 5 sinistri |
| `src/pages/cliente/ClienteDashboard.tsx` | Riscrittura completa con Recharts + KPI |
| `src/pages/cliente/ClientePolizze.tsx` | Card arricchite con compagnia, ramo, date |
| `src/pages/cliente/ClientePolizzaDetail.tsx` | Dettaglio completo tutti i campi |
| `src/pages/cliente/ClienteScadenze.tsx` | Scadenziario visuale con countdown |
| `src/pages/cliente/ClienteSinistri.tsx` | KPI + grafici riserve/liquidato |
| `src/components/ClienteLayout.tsx` | Sidebar gradiente teal |

