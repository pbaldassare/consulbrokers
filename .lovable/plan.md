

## Piano: Chat Interna Aziendale Strutturata

### Situazione attuale
- Esiste solo `ChatTab` usata come tab contestuale (su sinistri, titoli, prospect) con `chat_messaggi` legata a `entita_tipo`/`entita_id`
- La tabella `chat_messaggi` ha: `id`, `entita_tipo`, `entita_id`, `mittente_id`, `messaggio`, `letto`, `created_at`
- Ruoli disponibili: `admin`, `ufficio`, `produttore`, `contabilita`, `cfo`, `cliente`
- La rotta `/comunicazioni` e un PlaceholderPage
- La tabella `notifiche` esiste gia con `destinatario_id`, `letto`, `priorita`, `tipo`

### Architettura proposta

Due livelli di chat separati:

**Livello 1 — Chat Interna Aziendale** (nuova pagina `/comunicazioni`)
- Solo utenti interni (admin, ufficio, produttore, contabilita, cfo)
- Clienti NON vedono questa chat

**Livello 2 — Chat Contestuale Clienti** (gia esistente in ChatTab)
- Rimane invariata, legata a entita (sinistro, titolo, prospect)

### Nuove tabelle DB (migration)

**`chat_canali`** — Canali/conversazioni interne
- `id`, `nome`, `tipo` (diretto | gruppo | broadcast), `creato_da`, `created_at`, `ufficio_id`

**`chat_canali_membri`** — Membri di ogni canale
- `id`, `canale_id`, `user_id`, `ruolo_canale` (membro | admin), `created_at`

**`chat_messaggi_interni`** — Messaggi della chat interna
- `id`, `canale_id`, `mittente_id`, `messaggio`, `tipo_messaggio` (testo | conferma_lettura), `richiedi_conferma`, `created_at`

**`chat_conferme_lettura`** — Conferme di lettura per messaggi con richiesta
- `id`, `messaggio_id`, `user_id`, `confermato`, `confermato_at`, `created_at`

### Pagina Comunicazioni (`/comunicazioni`)

**Sidebar sinistra**: Lista canali con filtri
- Filtro per tipo: Tutti / Diretti / Gruppi / Broadcast
- Ricerca utente per nome
- Bottone "Nuova Conversazione" con dialog:
  - Seleziona destinatario singolo (chat diretta)
  - Seleziona multipli utenti (gruppo)
  - Filtro per ruolo: admin, ufficio, produttore, contabilita, cfo
  - Filtro per ufficio

**Area centrale**: Chat attiva
- Messaggi con avatar, nome, data/ora
- Input messaggio con bottone invio
- Per admin: checkbox "Richiedi conferma di lettura" prima dell'invio

**Conferma lettura (solo admin)**:
- Quando admin invia con `richiedi_conferma=true`, i destinatari vedono un popup/banner con "Conferma lettura" + pulsante
- Admin vede lo stato conferme: chi ha confermato, chi no, con timestamp
- Badge su messaggio con contatore conferme (es. "3/5 confermato")

### Filtri disponibili

- **Per utente singolo**: ricerca per nome/cognome nel dialog nuova conversazione
- **Per classe di utenti (ruolo)**: select ruolo → mostra tutti gli utenti di quel ruolo → broadcast/gruppo
- **Per ufficio**: filtra utenti per ufficio di appartenenza

### RLS Policies

- `chat_canali`: utente vede solo canali di cui e membro (via `chat_canali_membri`)
- `chat_messaggi_interni`: utente vede solo messaggi dei canali di cui e membro
- `chat_conferme_lettura`: utente puo inserire/vedere solo le proprie conferme; admin vede tutte quelle dei propri messaggi
- Cliente (`app_role = 'cliente'`) escluso da tutte le policy interne

### File coinvolti

| Azione | File |
|--------|------|
| Migration | 4 nuove tabelle + RLS policies |
| Creare | `src/pages/ComunicazioniPage.tsx` — pagina principale chat interna |
| Creare | `src/components/chat/CanaliSidebar.tsx` — lista canali con filtri |
| Creare | `src/components/chat/ChatArea.tsx` — area messaggi e input |
| Creare | `src/components/chat/NuovaConversazioneDialog.tsx` — dialog creazione canale |
| Creare | `src/components/chat/ConfermaLetturaPopup.tsx` — popup conferma per destinatari |
| Creare | `src/components/chat/ConfermeStatus.tsx` — stato conferme per admin |
| Modificare | `src/App.tsx` — sostituire PlaceholderPage con ComunicazioniPage |
| Modificare | `src/components/AppSidebar.tsx` — assicurare link Comunicazioni visibile |

