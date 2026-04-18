
## Diagnosi

Dalla screenshot: utente ha cercato "se", trovato "Consulbrokers Giuliano", selezionato (1 partecipante), cliccato "Crea conversazione" → errore.

Devo verificare:
1. Codice `handleCrea` in `NuovaConversazioneDialog.tsx`
2. Schema tabelle `chat_canali` e `chat_canali_membri`
3. RLS policies su `chat_canali` (INSERT)
4. Console/network logs per errore reale

## Esplorazione

Leggerò:
- `src/components/chat/NuovaConversazioneDialog.tsx` (funzione di creazione)
- Schema `chat_canali` + RLS
- Console logs preview

## Ipotesi probabile

Dopo la modifica precedente in cui ho escluso `cliente` con `.neq("ruolo", "cliente")`, è possibile che:
- L'INSERT su `chat_canali` fallisca per una RLS che richiede campi specifici (es. `entita_tipo` non null per ambito interno)
- Manca il record creator nei `chat_canali_membri`
- Nuovo campo richiesto non passato

## Piano di intervento

1. Leggere il codice attuale di `handleCrea` per capire il payload INSERT
2. Verificare RLS e constraint su `chat_canali` / `chat_canali_membri`
3. Controllare i log Postgres recenti per l'errore esatto
4. Fix mirato:
   - Se RLS: aggiornare policy INSERT
   - Se constraint NOT NULL: passare il valore corretto (es. `entita_tipo='argomento'` per chat interna diretta)
   - Aggiungere `toast.error` con messaggio dell'errore Supabase per dare visibilità
5. Aggiungere logging difensivo (`console.error`) nel catch

## File toccati (atteso)

- `src/components/chat/NuovaConversazioneDialog.tsx` — fix payload + error handling
- Eventuale migration RLS su `chat_canali` / `chat_canali_membri` se policy bloccante

## Cosa NON cambia

- Logica chat contestuale
- Filtro esclusione clienti
- Schema dati chat
