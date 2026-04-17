
## Richiesta

1. **Tutti i livelli di utenti** (admin, ufficio, executive, specialist/backoffice, produttore, corrispondente, consul, cliente, prospect) devono essere **visibili nella ricerca chat** e poter essere contattati direttamente (1-a-1 o gruppo).
2. **Tutto viene loggato** (chi parla con chi, contenuto, timestamp) → già parzialmente fatto via `log_attivita`, da estendere.
3. **Badge alert sul pulsante "Chat"** della sidebar con il **conteggio dei messaggi non letti** dell'utente corrente.

## Investigazione necessaria

Prima di implementare verifico:

1. **`src/components/chat/NuovaConversazioneDialog.tsx`** — capire come oggi vengono cercati gli utenti (probabilmente filtra solo alcuni ruoli) → estendere a TUTTI i ruoli (`admin`, `ufficio`, `executive`, `backoffice`, `produttore`, `corrispondente`, `consul`, `cliente`, `prospect`).

2. **`src/components/chat/CanaliSidebar.tsx`** — vedere la search "scar" nello screenshot (filtra canali esistenti). Verificare che non escluda nessun ruolo.

3. **`src/components/AppSidebar.tsx`** — voce "Chat" della sidebar: aggiungere badge con conteggio non letti.

4. **DB `chat_messaggi_interni` / `chat_canali_membri`** — verificare se esiste già un meccanismo di "letto/non letto" (es. campo `ultimo_letto_at` su `chat_canali_membri`). Se non esiste, va aggiunto.

5. **Logging** — `ChatTab.tsx` già logga via `logAttivita` (azione `messaggio_chat`). Verifico che anche `ChatArea.tsx` (chat globale `/chat`) faccia lo stesso → uniformare.

## Piano di implementazione

### 1. Ricerca utenti universale (`NuovaConversazioneDialog`)
- Rimuovere qualsiasi filtro di ruolo nella query `profiles` → mostrare TUTTI i `profiles` con `attivo=true`, raggruppati per ruolo con badge colorato (admin/ufficio/executive/backoffice/produttore/corrispondente/consul/cliente/prospect).
- Search server-side su `nome`, `cognome`, `email`, `ruolo`.
- Mostrare avatar/iniziali + nome completo + chip ruolo.

### 2. Membri canali — permettere qualunque ruolo
- Verificare RLS su `chat_canali_membri` e `chat_messaggi_interni`: tutti i ruoli (compreso cliente/prospect) devono poter leggere/scrivere nei canali di cui sono membri. Il portale cliente già usa `ChatTab` quindi RLS dovrebbe già supportarlo, ma confermo.

### 3. Sistema "letto/non letto"
- Aggiungere colonna `ultimo_letto_at TIMESTAMPTZ` su `chat_canali_membri` (se non esiste) tramite migration.
- Quando l'utente apre un canale (`ChatArea` con `canaleId` selezionato) → update `ultimo_letto_at = now()` per quella riga.
- Creare RPC `get_chat_unread_count(_user_id uuid)` che ritorna il totale di messaggi con `created_at > ultimo_letto_at` su tutti i canali di cui l'utente è membro (escludendo i propri messaggi).

### 4. Badge sul menu "Chat" in sidebar
- In `AppSidebar.tsx` (e analoghi: `ClienteLayout`, `ProspectLayout`) aggiungere `useQuery` che chiama l'RPC `get_chat_unread_count` ogni 15s + listener Supabase Realtime su `chat_messaggi_interni` per refresh immediato.
- Se count > 0 → mostrare badge rosso piccolo accanto a "Chat" con numero (max "9+").

### 5. Logging completo
- In `ChatArea.tsx` (sendMessage handler) aggiungere chiamata a `logAttivita` con:
  - `azione: "messaggio_chat"`
  - `entita_tipo: "chat_canale"` (oppure `entita_tipo` del canale se contestuale)
  - `entita_id: canaleId`
  - `dettagli_json: { preview, mittente_ruolo, destinatari_count, canale_tipo, ambito }`
- Già fatto in `ChatTab.tsx` → uniformare il payload.

### File toccati
- **Nuova migration**: aggiungere `ultimo_letto_at` a `chat_canali_membri` + RPC `get_chat_unread_count`
- `src/components/chat/NuovaConversazioneDialog.tsx` — ricerca su tutti i ruoli, raggruppamento per ruolo, badge colorato
- `src/components/chat/CanaliSidebar.tsx` — eventuale rimozione filtri ruolo nella search
- `src/components/chat/ChatArea.tsx` — update `ultimo_letto_at` all'apertura canale + log su invio
- `src/components/AppSidebar.tsx` — badge unread su voce Chat
- `src/components/ClienteLayout.tsx` e `src/components/ProspectLayout.tsx` — stesso badge sui rispettivi menu chat

### Tecnico
- Realtime: subscription su `postgres_changes` per `chat_messaggi_interni` filtrata per i canali dell'utente → invalidate badge query.
- Performance: l'RPC fa una sola query aggregata (`SELECT SUM(...)`) → ok anche con molti canali.
- Privacy: log_attivita salva solo preview (50 char), non l'intero messaggio → coerente con quanto già fatto in `ChatTab`.

### Conferme prima di procedere

1. Il **badge non letti** deve mostrare solo i messaggi nei canali dove sono **membro**, oppure anche broadcast non letti? → procedo con: tutti i canali di cui sono membro (inclusi broadcast a cui sono iscritto).
2. La **ricerca universale** include anche utenti `cliente` e `prospect` quando l'utente che cerca è interno (admin/ufficio/ecc.), e viceversa? Confermo: SÌ, qualunque ruolo può cercare e contattare qualunque altro ruolo (era questa la richiesta "tutti i livelli"). Se preferisci limitare (es. cliente non può cercare altri clienti) fammelo sapere prima.
