Aggiungo un pulsante "Esporta PDF" nell'header della conversazione attiva (portale cliente `/cliente/chat`) che genera un PDF graficamente curato con tutti i messaggi della conversazione corrente, completi di data/ora e log.

## Cosa aggiungo

**1. Nuova utility `src/lib/chat-pdf.ts`**
- Funzione `exportChatToPdf(canale, messaggi, membri)` che usa `pdf-lib` (già in dipendenze).
- Layout grafico:
  - Header con logo CBnet (`src/assets/logo-cbnet.svg`) + titolo "Conversazione Chat" + data di esportazione.
  - Banda colorata con il nome del canale, entità collegata (es. "Sinistro N° WEB-57793044"), stato (Aperto/Chiuso), data creazione.
  - Riquadro "Partecipanti" con elenco membri (nome + ruolo, terminologia Specialist/Consul/Sede già usata nel progetto).
  - Sezione "Messaggi" con bolle alternate (mittente a sinistra in grigio chiaro, cliente a destra in teal — coerente con la palette dark petrol green del brand). Ogni messaggio mostra: avatar iniziali, nome autore, ruolo, timestamp completo (gg/mm/aaaa HH:mm), testo, eventuali allegati come link.
  - Sezione finale "Log Attività" con eventi chiave (creazione canale, ingressi membri, letture) ordinati cronologicamente.
  - Footer con numero pagina, nome cliente e timestamp esportazione.
- Paginazione automatica con gestione overflow testo (word-wrap).

**2. Pulsante "Esporta PDF" nell'header chat**
- Aggiunto in `src/pages/cliente/ClienteComunicazioni.tsx` (la pagina del portale chat cliente visibile nello screenshot), accanto al titolo della conversazione attiva.
- Icona `Download` + label "Esporta PDF", stile coerente con i bottoni esistenti.
- Disabilitato quando nessuna conversazione è selezionata.
- Al click: carica messaggi + membri dal canale attivo, chiama `exportChatToPdf`, scarica via `saveAs` (blob → link `<a download>`).

**3. Recupero log attività**
- Query su `log_attivita` filtrata per `entita_tipo='chat_canale'` e `entita_id=canale.id` (e in fallback sugli eventi `chat_messaggi_interni` come timeline implicita).

## Vincoli rispettati
- Solo frontend + lib pura, nessuna edge function, nessuna modifica DB.
- Terminologia UI: Specialist/Consul/Sede (mai "Backoffice"/"Consul" generico).
- Palette: teal/dark petrol green (Core memory).
- File generati NON toccati (`types.ts`, `client.ts`).
- Nessuna modifica a paginazione/RLS/permessi.

## File modificati
- `src/lib/chat-pdf.ts` (nuovo)
- `src/pages/cliente/ClienteComunicazioni.tsx` (aggiunta bottone + handler)
