

## Diagnosi

Stato DB del titolo `450315855`:
| Campo | Valore | Atteso |
|---|---|---|
| premio_netto (Firma) | 3695.75 ✅ | 3695.75 |
| premio_netto_quietanza | 1695.75 ❌ | 3695.75 |
| tasse | 211.97 | 211.97 |
| premio_lordo | 1907.72 ❌ | 3907.72 |

Il form "Modifica Importi" in `TitoloDetail.tsx` salva ogni campo separatamente senza:
1. **Ricalcolare `premio_lordo`** quando cambiano netto/tasse/addizionali
2. **Sincronizzare Quietanza ← Firma** quando l'utente modifica solo la colonna Firma (il caso normale: la quietanza di rinnovo eredita dalla firma se non è stata toccata manualmente)

Il rinnovo poi legge `premio_lordo` (1907.72 stale) → bug a cascata.

## Fix

Modifica solo `src/pages/TitoloDetail.tsx` nella `saveImportiMutation` (dopo la validazione, prima dell'`update`):

### 1. Auto-ricalcolo `premio_lordo` se incoerente
Se l'utente non ha toccato manualmente `premio_lordo` (oppure il valore è incoerente di > 0.01€ rispetto a netto+tasse+addiz), forzare:
```ts
payload.premio_lordo = suggestedLordoFirma;
```
Stessa logica per il lordo quietanza (se esiste un campo dedicato), altrimenti coerenza solo su firma.

### 2. Sincronizzazione Firma → Quietanza
Quando l'utente modifica i campi Firma e i corrispondenti Quietanza non sono stati toccati nel form (cioè uguali al valore precedente in DB), propagare automaticamente:
- `premio_netto_quietanza = premio_netto`
- `tasse_quietanza = tasse`
- `addizionali_quietanza = addizionali`
- `provvigioni_quietanza = provvigioni_firma`

Logica: per ogni coppia firma/quietanza, se `quietanza_form == quietanza_db_originale` AND `firma_form != firma_db_originale` → aggiorna anche la quietanza con il nuovo valore firma.

### 3. UX: avvisi nel dialog
Mantenere i `toast.warning` esistenti ma renderli più visibili e aggiungere conferma "Vuoi sincronizzare anche la Quietanza?" se rileva divergenza intenzionale (opzionale, valutiamo se lo aggiungiamo o se la sync è automatica e silenziosa con un toast informativo).

**Decisione**: sync automatica + `toast.info("Quietanza e Premio Lordo aggiornati per coerenza")`. Più semplice e meno frizione.

### 4. Cleanup dati esistenti per il titolo corrente
Una `UPDATE` sul titolo `9cf0ec5e-...` per allineare:
- `premio_netto_quietanza = 3695.75`
- `premio_lordo = 3907.72`

## File toccati

- `src/pages/TitoloDetail.tsx` (~25 righe nella mutation)
- 1 UPDATE dati per il titolo `450315855` (via insert tool)

## Cosa NON faccio

- Niente RLS / schema / trigger DB (la sincronizzazione è applicativa, più trasparente per l'utente)
- Niente modifiche a Immissione / Rinnovo / Appendici
- Niente modifica ad altri titoli con dati incoerenti già salvati (se ce ne sono altri, lo facciamo dopo su richiesta)

## Verifica

1. Apro la polizza `9cf0ec5e-...` → vedo subito Premio Lordo 3907.72 e Quietanza 3695.75 (post cleanup)
2. Modifico Premio Netto Firma a 4000 → salvo
3. Verifico in DB: `premio_netto = 4000`, `premio_netto_quietanza = 4000`, `premio_lordo = 4211.97`
4. Apro il dialog di rinnovo → vedo 4000 / 4211.97 pre-compilati

