## Modifiche a `src/components/polizze/VociRcaCard.tsx`

### 1. Aggiungi/Rimuovi garanzie accessorie
Il bottone "Aggiungi voce" oggi è disabilitato quando `catalogoDisponibile.length === 0`. Verifico se la tabella `rca_garanzie` è popolata; in ogni caso:
- Rimuovo il `disabled` quando vuoto e mostro `CommandEmpty` con messaggio chiaro ("Nessuna garanzia configurata in `rca_garanzie`").
- Sposto il pulsante "Aggiungi voce" in posizione più visibile (header card, accanto al titolo) oltre a tenerlo in fondo.
- Verifico che l'icona cestino (Trash2) sia ben visibile su mobile e desktop per le righe non-RCA (già presente, ok).

### 2. Calcolo bidirezionale Netto ↔ Lordo
Oggi solo il netto è editabile e il lordo si ricalcola. Aggiungo:
- Colonna **Premio Lordo** ora editabile (Input al posto di solo testo) per le righe non-RCA-principale e per la RCA.
- Nuova funzione `calcolaNettoDaLordo(lordo, voce, aliquotaProv)`:
  - Accessorie: `netto = lordo / (1 + aliquota/100)`
  - RCA: `netto = lordo / (1 + aliqProv/100 + aliqProv/100 * SSN_PCT/100)` = `lordo / (1 + aliqProv/100 * 1.105)`
- Handler `handleLordoBlur(v, value)` che ricalcola il netto, salva `firma`, `lordo_calcolato`, `imposta_provinciale`, `ssn`.
- Mantengo `handleNettoBlur` invariato per la direzione opposta.
- Anche su mobile il campo Lordo diventa editabile.

### 3. Etichetta SSN
Sostituisco il testo `↳ Contributo SSN (10.5% sull'imposta)` con `↳ Contributo SSN 10,5%` (sia desktop che mobile). Niente formula in UI.

### 4. Sincronizzazione Firma ↔ Quietanza in tempo reale
Il trigger DB `premi_garanzia_sync_quietanza` aggiorna la Quietanza quando la Firma cambia, ma il refetch lato client può avvenire prima del completamento del trigger (race) o l'altra card non si aggiorna se montata in parallelo.

Soluzioni:
- In `upsertMut.onSuccess`, `addMut.onSuccess`, `deleteMut.onSuccess`: dopo `invalidateBoth()` aggiungo un secondo `invalidateBoth()` con `setTimeout(150ms)` per essere sicuri di leggere lo stato post-trigger.
- Aggiungo una sottoscrizione **Supabase Realtime** sulla tabella `premi_garanzia_polizza` filtrata per `titolo_id`, che fa `invalidateBoth()` ad ogni evento (INSERT/UPDATE/DELETE). Così la card Quietanza si aggiorna automaticamente quando il trigger DB scrive, anche se la mutation è partita dall'altra card.
- Cleanup del channel su unmount.

### 5. Note tecniche
- Nessuna modifica DB necessaria.
- Verifico che la tabella `rca_garanzie` esista e sia popolata; se vuota lo segnalo all'utente (non aggiungo seed automatico senza permesso).
- `defaultValue` sui nuovi Input Lordo deve essere ricalcolato da `calc.lordo` corrente; uso `key={...}` per forzare re-render quando cambia.

### File modificati
- `src/components/polizze/VociRcaCard.tsx`
