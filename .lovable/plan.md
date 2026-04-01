

## Piano: Fix RPC + Nuovi grafici CFO (solo dati reali)

### Problema
- `cfo_premi_per_compagnia` fa JOIN via `prodotti` (`prodotto_id` sempre NULL) → grafico vuoto
- `cfo_report_titoli` stesso problema → compagnia/produttore sempre "—"
- Mancano grafici per Ramo e Produttore

### Dati reali verificati nel DB (titoli incassati)

| Dimensione | Record con dato | Top entry |
|---|---|---|
| Compagnia (`compagnia_id`) | 530/720 | AON €10.5M, ALLIANZ €480K |
| Ramo (`ramo_id`) | ~720/720 | RCT/RCO €9.4M, Infortuni €1.4M |
| Produttore (`produttore_nome`) | 357/720 | COMODO EGIDIO €9.4M |

### Modifiche

**1. Migrazione SQL — Riscrivere 2 funzioni + creare 2 nuove**

- **`cfo_premi_per_compagnia`**: JOIN diretto `titoli.compagnia_id → compagnie` (invece di `prodotti → compagnie`). Aggiungere parametri `_ufficio_id`, `_compagnia_id`, `_produttore_nome`.

- **`cfo_report_titoli`**: JOIN diretto `titoli.compagnia_id → compagnie`, `titoli.ramo_id → rami`, `titoli.cliente_anagrafica_id → clienti`. Usare `titoli.produttore_nome`. Sostituire parametro `_produttore_id` con `_produttore_nome text`.

- **NUOVA `cfo_premi_per_ramo`**: Aggregazione premi incassati per ramo (`titoli.ramo_id → rami`), top 15, filtri date/ufficio.

- **NUOVA `cfo_premi_per_produttore`**: Aggregazione per `produttore_nome`, top 15, filtri date/ufficio.

**2. Frontend `AreaCFO.tsx`**

- Aggiungere filtri **Compagnia** (SearchableSelect, lista lunga) e **Produttore** (select con valori distinti `produttore_nome` dal DB) nei filtri globali
- Passare `_compagnia_id` e `_produttore_nome` alle query `cfo_kpi`, `cfo_premi_per_compagnia`, report
- Aggiungere 2 nuovi grafici nella griglia:
  - **Premi per Ramo** — BarChart orizzontale, top 15
  - **Premi per Produttore** — BarChart orizzontale, top 15
- Aggiornare il report per usare `_produttore_nome` al posto di `_produttore_id`, e mostrare colonna Ramo

### File coinvolti

| File | Azione |
|------|--------|
| Migrazione SQL | DROP+CREATE 2 RPC + CREATE 2 nuove |
| `src/pages/AreaCFO.tsx` | Filtri globali, 2 nuovi grafici, query aggiornate |

### Zero dati inventati
Tutto viene da dati reali già presenti nelle tabelle `titoli`, `compagnie`, `rami`. Nessun seed o dato fittizio.

