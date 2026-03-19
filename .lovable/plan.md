

## Piano: Restyling Grafico Area CFO

### Problemi attuali
- KPI cards troppo compresse in 7 colonne, testo piccolo e difficile da leggere
- Filtri senza bordi visivi chiari, layout piatto
- Grafici senza padding/spacing adeguato
- Mancano icone colorate e indicatori visivi per dare gerarchia ai dati
- Tabelle report e pagamenti senza stile distintivo

### Cosa faremo

#### 1. Header migliorato
- Titolo con icona BarChart3 colorata accent, sottotitolo con stile più elegante
- Bottone "Aggiorna KPI" con stile primary invece di outline

#### 2. Filtri globali ridisegnati
- Card con bordo sinistro accent colorato e background leggero
- Label più visibili, input con dimensioni coerenti
- Bottone Reset con icona

#### 3. KPI Cards ristrutturate
- Da 7 colonne compresse a grid 2-3-4 responsive (2 col mobile, 3 tablet, 4 desktop)
- Ogni card con icona colorata su sfondo circolare (bg-primary/10, bg-accent/10, bg-destructive/10)
- Valore più grande (text-2xl), label sopra con font-medium
- Colori differenziati per tipo: entrate verde/accent, uscite rosso, provvigioni primary, alert warning

#### 4. Tabs con stile migliorato
- TabsList con background più definito
- Tab content con spacing uniforme

#### 5. Grafici con card migliorate
- CardHeader con bordo inferiore leggero separator
- Altezza grafici aumentata (280→320px)
- Tooltip con formattazione italiana migliorata

#### 6. Tabelle report e pagamenti
- Header tabella con background muted
- Righe con hover più evidente
- Badge stato con colori semantici
- Bottoni azione con variante accent

### File coinvolti

| Azione | File |
|--------|------|
| Modificare | `src/pages/AreaCFO.tsx` — restyling completo layout, KPI, grafici, tabelle |

Nessuna modifica al backend o alle query, solo UI/UX.

