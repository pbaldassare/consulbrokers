# Chat lato Cliente — Hardening, performance e link dinamico polizze

Migliorie all'esperienza chat in `/cliente/chat`:

## 1. Header contestuale con fallback

`src/components/cliente/CanaleContextHeader.tsx`:
- Se la polizza non ha `numero_titolo`: badge "Polizza senza numero" in stile muted invece di "—".
- Se manca `targa_telaio`: nascondere il badge targa (oggi mostra "—").
- Se la query fallisce o l'entità non esiste: mostrare un alert compatto "Riferimento non più disponibile" senza far collassare l'header.
- Skeleton sottile (h-9) durante il caricamento per evitare salti di layout.
- Layout responsive: `min-h-[44px]` fisso, badge che vanno a capo con `flex-wrap` (già presente, da consolidare).

## 2. Sidebar: ordinamento, paginazione, indicatori

`src/pages/cliente/ClienteComunicazioni.tsx`:

**Ordinamento per ultimo messaggio**
- Nuova RPC `get_canali_cliente_with_meta(_user_id uuid)` che ritorna per ogni canale visibile al cliente:
  `id, nome, entita_tipo, entita_id, last_message_at, last_message_preview, unread_count`.
- Calcolo: JOIN su `chat_messaggi_interni` con `MAX(created_at)` per `last_message_at` e LATERAL per la preview; `unread_count = COUNT(messaggi WHERE mittente_id <> user AND created_at > ultimo_letto_at)`.
- Ordinamento DESC su `last_message_at` (NULLS LAST).

**Paginazione progressiva**
- React Query `useInfiniteQuery` con page size 20.
- "Carica altre" alla fine della lista; auto-trigger via IntersectionObserver sul sentinel.

**Indicatori non lette**
- Badge numerico (cerchio teal) accanto al nome canale quando `unread_count > 0`.
- Nome in `font-semibold` quando non letto, `font-normal` se letto.
- Preview ultimo messaggio (truncate 1 riga) sotto il nome, con orario relativo (`formatDistanceToNow`).
- Contatore globale: somma degli unread mostrato nel titolo "Chat (N)".

## 3. Link dinamico polizze in conversazione

Quando l'utente sta in una chat ad ambito `argomento` o `cliente`, mostrare sopra la lista messaggi un **selettore "Collega polizza"**:

- Nuovo componente `src/components/cliente/PolizzeLinkPicker.tsx`:
  - Popover con lista delle polizze attive del cliente (`titoli` filtrate da `get_my_cliente_ids`).
  - Click su una polizza → invia un messaggio strutturato `[POLIZZA:uuid]` nel canale (oppure inserisce un riferimento testuale "📎 Polizza N° XXX — Targa YYY").
  - In `ChatArea`, parsing dei messaggi: se contengono pattern `[POLIZZA:uuid]`, sostituirli con un chip cliccabile (badge teal con N° polizza + targa) che apre `/cliente/polizze/:id` in nuova route.

Implementazione minima senza modifiche schema: il messaggio viene salvato come testo con marker, e il renderer lato client lo trasforma in chip arricchito (lookup batch su `titoli` per gli id citati nel canale corrente).

## 4. File coinvolti

- **Nuovi**:
  - `src/components/cliente/PolizzeLinkPicker.tsx`
  - `src/components/cliente/MessaggioConChip.tsx` (renderer messaggio con chip polizza)
- **Modificati**:
  - `src/components/cliente/CanaleContextHeader.tsx` (fallback, skeleton, alert)
  - `src/pages/cliente/ClienteComunicazioni.tsx` (sidebar arricchita, infinite scroll, badge unread)
  - `src/components/chat/ChatArea.tsx` (slot opzionale `aboveMessages` per il PolizzeLinkPicker, e renderer chip via prop `messageRenderer`)
- **Nuova migrazione**:
  - RPC `get_canali_cliente_with_meta(_user_id uuid)` SECURITY DEFINER con search_path public, restituisce SETOF della struttura sopra. Filtra su `chat_canali_membri.user_id = _user_id` AND `chat_canali.ambito='contestuale'` AND `visibile_cliente=true`.

## 5. Note tecniche

- Non si tocca lo schema delle tabelle, solo aggiunta RPC.
- Riuso della RPC esistente `mark_canale_as_read` per azzerare `unread_count` all'apertura (già chiamata in `ChatArea`).
- Lo staff side (`/comunicazioni`) non viene toccato: tutte le modifiche a `ChatArea` saranno opt-in via prop opzionali.
- Realtime: l'auto-refetch ogni 10s già presente è sufficiente; in futuro si potrà passare a Supabase Realtime su `chat_messaggi_interni`.
