

## Piano: Commerciale su Polizza + Provvigioni Sede

### Concetto

Ogni polizza ha una **provvigione totale agenzia** (es. 5% dal ramo/compagnia). A questa polizza si collega un **commerciale** (produttore). Il commerciale ha una sua % (es. 60%), che si applica sulla provvigione agenzia: il commerciale prende il 60% del 5% = 3%, la sede prende il restante 40% del 5% = 2%. Se il commerciale e "Sede" (100%), tutta la provvigione va alla sede.

```text
Polizza: Allianz Milano, Ramo Auto, Premio €1000
  └─ Provv. Agenzia: 5% = €50
       ├─ Commerciale (Mario, 60%): 60% di €50 = €30
       └─ Sede (residuo): 40% di €50 = €20
```

### Interventi

**1. Migration SQL**
- Aggiungere `commerciale_id uuid REFERENCES profiles(id)` e `percentuale_commerciale numeric` alla tabella `titoli`
- La provvigione sede = provvigione agenzia totale - quota commerciale (calcolata in app)

**2. ImmissionePolizzaPage.tsx — Aggiungere campo Commerciale**
- Nella sezione Provvigioni, aggiungere:
  - Select "Commerciale" (da profiles con ruolo commerciale/AE/produttore)
  - Input "% Commerciale" (default 100 = sede)
  - Riepilogo calcolato: Provv. Commerciale € / Provv. Sede €
- Salvare `commerciale_id` e `percentuale_commerciale` nel titolo

**3. TitoloDetail.tsx — Mostrare split provvigioni**
- Nella sezione provvigioni, mostrare:
  - Commerciale collegato + sua %
  - Importo commerciale e importo sede calcolati

**4. Nuova pagina "Provvigioni Sede" + voce sidebar**
- Nuova voce nel menu laterale sotto Portafoglio o come voce singola
- Pagina che mostra il riepilogo delle provvigioni sede:
  - Filtri: periodo, compagnia, ramo
  - Tabella: per ogni polizza mostra premio, provv. agenzia %, provv. commerciale %, residuo sede
  - KPI totali in alto: Totale Provvigioni Sede, Totale Provvigioni Commerciali
- La provvigione sede = `provvigione_agenzia * (100 - percentuale_commerciale) / 100`

**5. Profilo "Sede" come commerciale speciale**
- Il commerciale con 100% = "Sede" (tutta la provvigione va alla sede)
- Nella select commerciale, la prima opzione e "Sede (100%)" che setta automaticamente percentuale_commerciale = 100

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| Migration | `ALTER TABLE titoli ADD COLUMN commerciale_id uuid REFERENCES profiles(id), ADD COLUMN percentuale_commerciale numeric DEFAULT 100` |
| File modificati | `ImmissionePolizzaPage.tsx`, `TitoloDetail.tsx`, `AppSidebar.tsx`, nuovo `ProvvigioniSedePage.tsx` |
| Calcolo sede | `provv_sede = premio * (provv_agenzia_% / 100) * ((100 - perc_commerciale) / 100)` |
| Calcolo commerciale | `provv_comm = premio * (provv_agenzia_% / 100) * (perc_commerciale / 100)` |
| Default | Se nessun commerciale selezionato → percentuale_commerciale = 100 (tutto alla sede) |

