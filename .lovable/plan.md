## Collegare "Prossime Scadenze" → Polizza → Scadenziario

### Stato attuale
- **Dashboard cliente** (`ClienteDashboard.tsx`): il widget "Prossime Scadenze" mostra le polizze in scadenza nei prossimi 90gg ma le righe **non sono cliccabili**.
- **Lista Scadenze** (`ClienteScadenze.tsx`): già collega ogni card a `/cliente/polizze/:id` ✅.
- **Dettaglio polizza** (`ClientePolizzaDetail.tsx`): contiene già la card "Rate / Quietanze" con le date di decorrenza/scadenza di tutte le rate — è di fatto lo **scadenziario** della polizza, ma non ha un ancoraggio dedicato e l'etichetta non lo evidenzia.

### Modifiche

1. **`ClienteDashboard.tsx` — widget Prossime Scadenze**
   - Avvolgere ogni riga in `<Link to={"/cliente/polizze/${s.id}#scadenziario"}>` con hover (stesso stile delle card lista scadenze).
   - Mostrare anche il nome compagnia sotto al ramo per coerenza con la lista.
   - Aggiungere in fondo un link "Vedi tutte →" a `/cliente/scadenze`.

2. **`ClienteScadenze.tsx`**
   - Cambiare il target dei link in `/cliente/polizze/${p.id}#scadenziario` così atterrando in dettaglio si scrolla direttamente sulla sezione rate.

3. **`ClientePolizzaDetail.tsx` — sezione Scadenziario**
   - Rinominare la card "Rate / Quietanze" in **"Scadenziario (Rate / Quietanze)"** e aggiungere `id="scadenziario"` al `<Card>`.
   - Aggiungere un `useEffect` che, se `location.hash === "#scadenziario"`, fa `scrollIntoView({ behavior: "smooth" })` sull'elemento.
   - Aggiungere una colonna "Giorni" (gg mancanti alla scadenza della rata) con badge colorato (rosso ≤30, arancio ≤60, giallo ≤90, grigio oltre) per allineare visivamente al concetto di scadenziario.
   - Aggiungere in alto alla card un mini-riepilogo: "Prossima rata: <data> — <importo>" calcolato dalla prima quietanza con `stato != "incassata"` e `data_scadenza >= oggi`.

### Note
- Nessuna modifica DB: lo scadenziario è già rappresentato dalla tabella `quietanze` (una riga per rata) collegata a `titoli`.
- Nessuna modifica a permessi/RLS: le pagine usano già le RLS cliente esistenti.
- Lavoro solo di frontend (presentazione + navigazione).