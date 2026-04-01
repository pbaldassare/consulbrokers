

## Piano: Nuovi campi sinistri + grafici dashboard + simulazione dati Comune di Varese

### Fase 1 — Migrazione SQL: nuovi campi nella tabella `sinistri`

Aggiungere colonne mancanti per il dettaglio completo:

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `perito_id` | uuid FK → anagrafiche_professionali | Perito assegnato |
| `liquidatore_id` | uuid FK → anagrafiche_professionali | Liquidatore assegnato |
| `medico_legale` | text | Nome medico legale |
| `dinamica` | text | Descrizione dinamica sinistro |
| `indirizzo_sinistro` | text | Indirizzo completo luogo sinistro |
| `citta_sinistro` | text | Citta del sinistro |
| `provincia_sinistro` | text | Provincia |
| `cap_sinistro` | text | CAP |
| `data_denuncia` | date | Data denuncia |
| `ramo_sinistro` | text | Ramo assicurativo (es. RCT/O) |

Campi gia presenti e utilizzabili: `controparte`, `targa_veicolo`, `franchigia`, `note_perito`, `numero_sinistro_compagnia`, `costo_preventivato`, `costo_effettivo`.

### Fase 2 — Aggiornare i 5 sinistri esistenti + aggiungerne 3 nuovi

**Aggiornare** i sinistri del Comune di Varese con i nuovi campi (perito, liquidatore, medico legale, indirizzo, dinamica, data denuncia, ramo, controparte, numero sinistro compagnia, franchigia).

**Inserire 3 sinistri aggiuntivi** per avere dati piu ricchi:
- Grandine su veicoli (Kasko) — chiuso
- Infortunio dipendente 2 (Infortuni) — aperto
- Responsabilita patrimoniale (RC Patrimoniale) — in_lavorazione

Totale: 8 sinistri (4 aperti, 4 chiusi), distribuiti su rami diversi.

### Fase 3 — Dashboard: sostituire "Sinistri Recenti" con 2 nuovi grafici

In `ClienteDashboard.tsx`, nella sezione bottom-row, sostituire la card "Sinistri Recenti" con:

1. **PieChart "Sinistri per Ramo"** — torta che mostra sinistri aperti vs chiusi raggruppati per ramo (usando colori diversi per aperti/chiusi)
2. **BarChart "Rapporto Premi/Sinistri per Anno"** — barre affiancate che mostrano premi pagati e sinistri liquidati per anno (2024, 2025)

### Fase 4 — Pagina Sinistri: dettaglio espanso + nuovo grafico

In `ClienteSinistri.tsx`:

- Aggiungere il **grafico PieChart sinistri per ramo (aperti vs chiusi)** al posto dell'attuale "Distribuzione per Tipo"
- Aggiungere colonne in tabella: **Ramo**, **Perito**, **Liquidatore**, **Indirizzo**
- Rendere ogni riga cliccabile per espandere un **pannello dettaglio** con tutti i campi: dinamica, controparte, medico legale, franchigia, data denuncia, indirizzo completo, note perito, numero sinistro compagnia, costi preventivato/effettivo

### File coinvolti

| File | Azione |
|------|--------|
| Migrazione SQL | ALTER TABLE sinistri + 3 FK |
| Dati SQL (insert tool) | UPDATE 5 sinistri + INSERT 3 nuovi |
| `src/pages/cliente/ClienteDashboard.tsx` | Sostituire sinistri recenti con 2 grafici |
| `src/pages/cliente/ClienteSinistri.tsx` | Tabella arricchita + dettaglio espandibile + grafico ramo |

