
## Analisi sezione "Periodo"

12 campi, mix di **date**, **numerici**, e **enum**. Alcuni sono auto-calcolabili dalle date principali, altri vanno editati a mano.

### Classificazione dei campi

**📅 Editabili — Date principali (DatePicker)**
- `durata_da` — inizio contratto (data emissione)
- `durata_a` — fine contratto (durata totale, può essere poliennale)
- `garanzia_da` — inizio copertura corrente
- `garanzia_a` — fine copertura corrente (= scadenza rata)
- `data_competenza` — data di competenza contabile
- `data_scadenza` — scadenza polizza (rata in corso)
- `limite_mora` — data limite per pagamento in mora

**🔢 Editabili — Numerici (Input number)**
- `anni_durata` — durata in anni (auto-suggerito da `durata_da`/`durata_a`, ma editabile)
- `rate` — numero rate annuali (1, 2, 4, 12)
- `mora_giorni` — giorni di tolleranza mora (default 15)
- `disdetta_mesi` — mesi di preavviso disdetta (default 3)

**📋 Editabile — Enum (SearchableSelect)**
- `tipo_rinnovo` — valori: `tacito_rinnovo`, `scadenza_annuale`, `disdetta`, `nessuno` (memory `policy-lifecycle-operations`)

### Auto-calcoli intelligenti (suggeriti, non forzati)
Quando l'utente cambia `durata_da` o `durata_a` in modalità edit:
- Calcolo `anni_durata` = mesi tra le due date / 12 (arrotondato)
- Avviso visivo (badge) se la differenza supera 13 mesi → "Polizza Poliennale" (per coerenza con `mem://insurance/policy-valuation-rules`)

Quando l'utente cambia `garanzia_a`:
- Auto-suggerisce `data_scadenza = garanzia_a` (campo allineato per default; l'utente può sovrascrivere)
- Auto-suggerisce `limite_mora = garanzia_a + mora_giorni`

Questi sono **suggerimenti** mostrati come hint sotto il campo: l'utente può accettarli o digitare valori diversi.

### Validazioni di coerenza (al salvataggio)
- `durata_da` ≤ `durata_a` (errore bloccante)
- `garanzia_da` ≥ `durata_da` e `garanzia_a` ≤ `durata_a` (errore bloccante)
- `garanzia_da` ≤ `garanzia_a` (errore bloccante)
- `limite_mora` ≥ `data_scadenza` (warning, non bloccante)
- `rate` ∈ {1, 2, 4, 6, 12} (warning se valore diverso)

### Pattern UI
Stesso pattern di "Contratto":
- Pulsante **Modifica** in alto a destra della card Periodo
- In edit mode: `DatePicker` per le date, `Input type="number"` per numerici, `SearchableSelect` per `tipo_rinnovo`
- Pulsanti **Annulla / Salva** in fondo
- Mutation `savePeriodoMutation` → `UPDATE titoli` + `logAttivita` con diff dei campi
- Invalida `['titolo', id]`

### File toccato
- `src/pages/TitoloDetail.tsx` — sezione "Periodo" (righe 1082-1098) + `editingPeriodo`, `periodoForm`, `savePeriodoMutation`

### Lookup
- `tipoRinnovoOpts`: array hardcoded `[{value:"tacito_rinnovo", label:"Tacito Rinnovo"}, {value:"scadenza_annuale", label:"Scadenza Annuale"}, {value:"disdetta", label:"Disdetta"}, {value:"nessuno", label:"Nessuno"}]`

### Cosa NON cambia
- Sezioni Regolazione, Importi, Veicolo restano per i prossimi step.
- La logica di poliennale (memory) e gli operatori di ciclo vita non vengono toccati: rileggono i nuovi valori al refresh.

### Prossimo step (dopo l'approvazione di Periodo)
**Importi & Premi** (Premio Netto, Tasse, Addizionali, Premio Lordo, Provvigioni) — con auto-calcolo `Premio Lordo = Netto + Tasse + Addizionali`.
