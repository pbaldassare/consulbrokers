
## Richiesta

Nel dettaglio titolo, nascondere il pulsante/sezione **"Messa a Cassa"** quando la polizza è già stata messa a cassa (non si può incassare due volte la stessa polizza). Eccezione: per **polizze poliennali attive** il pulsante deve restare visibile (perché ci sono più rate annuali da incassare).

## Investigazione

Devo verificare in `src/pages/TitoloDetail.tsx`:
1. Dove viene renderizzato il blocco "Messa a Cassa" (sezione/pulsante che apre `MessaCassaDialog`)
2. La condizione attuale di visibilità
3. Come identificare una polizza poliennale (memory: `policy-valuation-rules` → durata > 13 mesi tra `data_decorrenza` e `data_scadenza`)

## Piano

### File toccato
- `src/pages/TitoloDetail.tsx`

### Logica nuova di visibilità "Messa a Cassa"

Mostrare il pulsante/sezione **Messa a Cassa** solo quando:
```
NOT data_messa_cassa  // mai messa a cassa
OR (è poliennale AND stato === 'attivo')  // poliennale attiva con rate residue
```

In altri termini: nascondere quando `data_messa_cassa` è valorizzata, **tranne** se la polizza è poliennale e attiva.

### Helper per "poliennale"
Calcolo inline (coerente con `mem://insurance/policy-valuation-rules`):
```ts
const isPoliennale = (() => {
  if (!t.data_decorrenza || !t.data_scadenza) return false;
  const start = new Date(t.data_decorrenza);
  const end = new Date(t.data_scadenza);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return months > 13;
})();

const showMessaACassa = !t.data_messa_cassa || (isPoliennale && t.stato === "attivo");
```

### Cosa NON cambia
- Le altre operazioni (Sospensione, Riattivazione, Storno, Duplicazione, Rinnovo, Appendici) restano regolate dalla logica già esistente.
- Il pulsante "Annulla Messa a Cassa" (per admin) resta visibile dove già previsto.
- `MessaCassaDialog.tsx` non viene modificato.

### Note
- Per polizze annuali già incassate → pulsante nascosto (corretto: non si rincassa).
- Per polizza poliennale attiva già incassata una volta → pulsante visibile (rate successive).
- Per polizza poliennale già scaduta/sospesa → pulsante nascosto.
