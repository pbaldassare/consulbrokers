

## Chiarimento concetto: cosa significa "Carico di Aprile 2026"

Il **Carico del Mese M** = elenco delle polizze la cui **prossima rata da incassare** ha **decorrenza** nel mese M (cioè il nuovo periodo di copertura **inizia** in M).

Quindi per "Carico Aprile 2026" intendiamo: tutte le polizze il cui **nuovo periodo** parte ad Aprile 2026. La data che conta è **`garanzia_da` del titolo da quietanzare** (= `garanzia_a` precedente + 1 giorno), non la fine.

## Esempi concreti — Carico di Aprile 2026

### Esempio 1 — Annuale che parte ad aprile
- Polizza A annuale (`rate=1`)
- Periodo precedente: `01/04/2025 → 31/03/2026`
- **Nuovo titolo nel Carico Aprile 2026**: `01/04/2026 → 31/03/2027`
- Decorrenza ad aprile 2026, scadenza ad aprile 2027 ✅

### Esempio 2 — Semestrale che parte ad aprile
- Polizza B semestrale (`rate=2`)
- Periodo precedente: `01/10/2025 → 31/03/2026`
- **Nuovo titolo nel Carico Aprile 2026**: `01/04/2026 → 30/09/2026`
- Decorrenza aprile 2026, prossima rata in ottobre 2026 (che finirà nel Carico Ottobre 2026)

### Esempio 3 — Trimestrale che parte ad aprile
- Polizza C trimestrale (`rate=4`)
- Periodo precedente: `01/01/2026 → 31/03/2026`
- **Nuovo titolo nel Carico Aprile 2026**: `01/04/2026 → 30/06/2026`
- La rata successiva andrà nel Carico Luglio 2026

### Esempio 4 — Mensile che parte ad aprile
- Polizza D mensile (`rate=12`)
- Periodo precedente: `01/03/2026 → 31/03/2026`
- **Nuovo titolo nel Carico Aprile 2026**: `01/04/2026 → 30/04/2026`
- Tornerà nel Carico Maggio 2026, e così via ogni mese

### Esempio 5 — Poliennale 3 anni con rata annuale
- Polizza E poliennale `01/04/2024 → 31/03/2027`, `rate=1`
- Quietanza precedente: `01/04/2025 → 31/03/2026`
- **Nuovo titolo nel Carico Aprile 2026**: `01/04/2026 → 31/03/2027` (ultimo anno della poliennale)
- Dopo, niente rinnovo automatico (poliennale finita)

### Esempio 6 — Polizza nuova emissione ad aprile
- Polizza F appena emessa con decorrenza `15/04/2026`, annuale
- Compare nel **Carico Aprile 2026** come **nuova immissione**, non come rinnovo
- Periodo: `15/04/2026 → 14/04/2027` → prossimo carico Aprile 2027

### Esempio 7 — Semestrale che parte ad aprile (seconda rata di una poliennale 2 anni)
- Polizza G `rate=2`, decorrenza originale `01/10/2025`
- Quietanze nel tempo:
  - I rata: `01/10/2025 → 31/03/2026` → Carico Ottobre 2025
  - II rata: `01/04/2026 → 30/09/2026` → **Carico Aprile 2026** ✅
  - III rata: `01/10/2026 → 31/03/2027` → Carico Ottobre 2026
  - IV rata: `01/04/2027 → 30/09/2027` → Carico Aprile 2027

### Esempio 8 — Polizza scaduta non rinnovata
- Polizza H annuale, `garanzia_a = 31/03/2026`, mai messa a cassa
- **NON compare nel Carico Aprile 2026** (resta "scaduta", va in Storico)
- Premi del periodo 2025-2026 → read-only

### Esempio 9 — Polizza incassata in ritardo
- Polizza I annuale, periodo precedente scaduto `31/03/2026`, messa a cassa il 20/04/2026
- Il rinnovo `01/04/2026 → 31/03/2027` viene generato e attivato il 20/04/2026
- Compare comunque nel **Carico Aprile 2026** (la decorrenza è 01/04, conta quella)

### Esempio 10 — Sospensione/riattivazione
- Polizza L annuale `01/04/2025 → 31/03/2026`, sospesa il 15/01/2026 e riattivata il 10/03/2026
- Il periodo coperto resta `01/04/2025 → 31/03/2026` (con eventuale prolungamento per giorni di sospensione, gestito da Appendice)
- Il rinnovo regolare entra nel **Carico Aprile 2026** con decorrenza `01/04/2026`

## Ricapitolando la regola operativa

| Caso | Dove finisce il rinnovo |
|------|--------------------------|
| Annuale con scadenza 31/03/2026 | Carico Aprile 2026 → nuovo periodo fino a 31/03/2027 |
| Semestrale con scadenza 31/03/2026 | Carico Aprile 2026 → nuovo periodo fino a 30/09/2026 |
| Trimestrale con scadenza 31/03/2026 | Carico Aprile 2026 → nuovo periodo fino a 30/06/2026 |
| Mensile con scadenza 31/03/2026 | Carico Aprile 2026 → nuovo periodo fino a 30/04/2026 |
| Annuale con scadenza 31/03/2027 | Carico Aprile 2027 (NON 2026) |

## Implementazione tecnica (riepilogo, già approvata nel piano precedente)

### Vista `v_portafoglio_titoli` — campi calcolati
- `prossima_garanzia_da` = `garanzia_a + 1 giorno`
- `prossima_garanzia_a` = `garanzia_a + intervallo(rate)`:
  - rate=1 → +12 mesi
  - rate=2 → +6 mesi
  - rate=4 → +3 mesi
  - rate=3 → +4 mesi
  - rate=12 → +1 mese
- `mese_carico` = `to_char(prossima_garanzia_da, 'YYYY-MM')` ← **mese di partenza del nuovo periodo**
- `premi_modificabili` (boolean): false se `garanzia_a < oggi - 7gg` AND `stato = 'incassato'`

### Filtro Carico Mese (modifica chiave)
- **Vecchio**: filtro per `data_scadenza ∈ [inizio_mese, fine_mese]`
- **Nuovo**: filtro per `prossima_garanzia_da ∈ [inizio_mese, fine_mese]` (cioè la **decorrenza** della nuova rata cade nel mese)

### `RinnovoTitoloDialog.tsx`
- Pre-compila `garanzia_da` = `titolo.garanzia_a + 1 giorno`
- Pre-compila `garanzia_a` nuovo = `garanzia_da + intervallo(rate)`
- UI mostra: "Periodo coperto dal rinnovo: 01/04/2026 → 31/03/2027"

### `PortafoglioCaricoPage.tsx`
- Header esplicativo: "Carico Aprile 2026 = polizze il cui nuovo periodo di copertura inizia ad Aprile 2026"
- Colonna "Periodo coperto": mostra `prossima_garanzia_da → prossima_garanzia_a`
- Colonna "Frequenza" (annuale/semestrale/trimestrale/mensile)

### `TitoloDetail.tsx` — premi read-only su titoli storici
- Se `premi_modificabili = false` → pulsanti "Modifica Importi" disabilitati con tooltip
- Banner: "🔒 Periodo dal gg/mm/aaaa al gg/mm/aaaa — premi consolidati"
- Override admin via "Sblocca temporaneamente" (loggato in `attivita`)

### Trigger DB di sicurezza
`BEFORE UPDATE ON titoli` blocca update di `premio_netto/addizionali/tasse/premio_lordo/provvigioni_*` se:
- `garanzia_a < CURRENT_DATE - INTERVAL '7 days'` AND `stato = 'incassato'`
- Bypass admin via `current_setting('app.bypass_premi_lock', true) = 'on'`

### Helper `src/lib/policyPeriod.ts` (NEW)
- `calcolaProssimoPeriodo(rate, garanziaA): { da, a }`
- `premiModificabili(titolo): boolean`
- `descrizioneFrequenza(rate): string`

## File toccati
- `supabase/migrations/<new>.sql` — vista + trigger
- `src/lib/policyPeriod.ts` (NEW)
- `src/components/polizze/RinnovoTitoloDialog.tsx`
- `src/pages/PortafoglioCaricoPage.tsx`
- `src/pages/TitoloDetail.tsx`

## Cosa NON faccio
- Non tocco `in_attesa_rinnovo` (già implementato)
- Non modifico la regola "duplicati legacy aprile 2026"
- Non cambio Storico/Attive (logica esistente)

## Verifica end-to-end
1. `/portafoglio/carico` ad Aprile 2026 → vedo annuali con decorrenza aprile e periodo 04/2026→04/2027
2. Nella stessa lista, una semestrale aprile-settembre 2026 e una trimestrale aprile-giugno 2026
3. Una polizza annuale che scade aprile 2027 NON compare nel carico aprile 2026 (comparirà nel 2027)
4. Apro polizza con `garanzia_a = 31/03/2025` incassata → blocco Importi disabilitato con lucchetto
5. Admin clicca "Sblocca temporaneamente" → modifica permessa, log creato
6. Rinnovo polizza trimestrale → dialog precompila +3 mesi automaticamente
7. SQL diretto di update premi su titolo storico → trigger blocca

