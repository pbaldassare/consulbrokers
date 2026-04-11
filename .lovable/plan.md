

## Piano: Auto-collegamento intelligente di tutti gli attori nella Chat

### Problema attuale
Quando si crea una chat collegata a una polizza, sinistro o trattativa, viene aggiunto solo il cliente (user_id). Non vengono inclusi automaticamente i soggetti collegati: corrispondenti, commerciali (AE, produttori), responsabili, staff dell'ufficio.

### Soluzione
Creare una funzione `findAllRelatedUsers` che, data un'entita (polizza, sinistro, trattativa, cliente), raccoglie TUTTI gli utenti collegati e li pre-seleziona come partecipanti alla chat.

### Logica di raccolta utenti per tipo entita

**Polizza (titolo)**:
- `cliente_anagrafica_id` → `clienti.user_id` (il cliente)
- `produttore_id` (il produttore assegnato alla polizza)
- `ufficio_id` → tutti i profiles con quell'ufficio_id (staff dell'ufficio)
- `codici_commerciali_cliente` con `cliente_id = cliente_anagrafica_id` → `profilo_id` (AE, corrispondenti, agenti)

**Sinistro**:
- `cliente_anagrafica_id` → `clienti.user_id`
- `responsabile_id` (il responsabile del sinistro)
- `titolo_id` → stessa logica della polizza (produttore, ufficio, commerciali)

**Trattativa**:
- `cliente_id` → `clienti.user_id`
- `assegnato_a` (utente assegnato)
- `ufficio_id` → staff ufficio
- `codici_commerciali_cliente` con `cliente_id` → commerciali

**Cliente**:
- `clienti.user_id`
- `codici_commerciali_cliente` con `cliente_id` → tutti i commerciali
- `profiles` con `ufficio_id` del cliente (se ha un ufficio associato)

### Modifiche

#### 1. `src/components/chat/NuovaConversazioneDialog.tsx`
- Aggiungere funzione `findAllRelatedUsers(entitaTipo, entitaId)` che ritorna un array di `{ userId, ruolo, nome }` con tutti i soggetti collegati
- Quando si seleziona un'entita, chiamare questa funzione e pre-selezionare TUTTI gli utenti trovati nella lista partecipanti
- Mostrare un riepilogo visivo: "Auto-collegati: 3 staff, 1 cliente, 2 commerciali"
- L'utente puo' comunque rimuovere o aggiungere altri partecipanti

#### 2. `src/components/ChatTab.tsx`
- Aggiornare `findClienteUserId` → `findAllRelatedUserIds` con la stessa logica
- Alla creazione automatica del canale, aggiungere TUTTI gli utenti collegati come membri (non solo il cliente)

#### 3. Logging migliorato
- In `ChatArea.tsx`, il log gia include `mittente_id` nel messaggio (tabella `chat_messaggi_interni`)
- Aggiungere `logAttivita` anche in `ChatArea.tsx` quando si invia un messaggio, con `dettagli_json: { mittente_ruolo: profile.ruolo, preview: msg.slice(0,50) }`
- Ogni messaggio e' gia tracciato con `mittente_id` + timestamp nella tabella

### File coinvolti

| File | Azione |
|------|--------|
| `src/components/chat/NuovaConversazioneDialog.tsx` | Aggiungere `findAllRelatedUsers`, pre-selezionare tutti i collegati, riepilogo visivo |
| `src/components/ChatTab.tsx` | Espandere auto-membership a tutti i collegati (non solo cliente) |
| `src/components/chat/ChatArea.tsx` | Aggiungere `logAttivita` per ogni messaggio inviato con ruolo mittente |

### Nessuna modifica database
Tutte le relazioni necessarie esistono gia: `codici_commerciali_cliente`, `titoli`, `sinistri`, `trattative`, `profiles`.

