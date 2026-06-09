## Fix di 3 bug

### 1. Aggiungere "Spett.le" alla select Titolo
- `src/pages/ClienteDetail.tsx` (riga 2156): aggiungere `{ value: "spett", label: "Spett.le" }` all'array opzioni `Titolo`.
- `src/components/clienti/NuovoClienteDialog.tsx` (riga 853): aggiungere `<SelectItem value="spett">Spett.le</SelectItem>`.

### 2. Stato cliente = "attivo" di default se ha almeno 1 polizza/quietanza
Migrazione SQL una-tantum + futura coerenza:
- Backfill: `UPDATE public.clienti SET stato_cliente = 'attivo' WHERE (stato_cliente IS NULL OR stato_cliente = '') AND EXISTS (SELECT 1 FROM public.titoli t WHERE t.cliente_id = clienti.id);`
- Trigger DB su INSERT di `titoli`: se il cliente collegato ha `stato_cliente` NULL/vuoto, lo imposta a `'attivo'`. Così ogni nuova polizza/quietanza inserita garantisce lo stato.

### 3. AddressAutocomplete: non riaprire suggerimenti su valore esistente
In `src/components/AddressAutocomplete.tsx`:
- Inizializzare `suppressPredictionsRef.current = true` (default suppress ON al mount).
- Sbloccare i suggerimenti **solo** quando l'utente digita davvero nell'input (dentro `handleInputChange`, già presente — corretto).
- Aggiungere `onFocus` che NON forza l'apertura se l'utente non sta digitando: rimuovere il `onFocus={() => predictions.length > 0 && setOpen(true)}` perché basta digitare per riaprire. Mantenere chiusura su blur.
- Effetto: caricando una pagina con indirizzo già valorizzato (es. `Via Michelangelo, 71`) non comparirà la dropdown di indirizzi simili; comparirà solo quando l'utente clicca/cursore e modifica il testo.

### File toccati
- `src/pages/ClienteDetail.tsx` — 1 riga
- `src/components/clienti/NuovoClienteDialog.tsx` — 1 riga
- `src/components/AddressAutocomplete.tsx` — 2 piccole modifiche (init ref + rimozione apertura on focus)
- 1 migrazione SQL (backfill + trigger su `titoli`)
