# Chat lato Cliente — Conversazioni contestuali, ricerca e header arricchito

Estendere `src/pages/cliente/ClienteComunicazioni.tsx` per consentire al cliente di:
1. Avviare una **nuova conversazione** scegliendo il contesto (Argomento libero / Polizza / Sinistro).
2. **Cercare** all'interno delle conversazioni (titolo + contenuto messaggi).
3. Vedere in evidenza, quando il canale è su una **polizza**, il numero polizza e la targa/telaio (se presenti).

## 1. Nuova conversazione lato cliente

Nuovo componente `src/components/cliente/NuovaChatClienteDialog.tsx` (ispirato a `NuovaConversazioneDialog` ma semplificato per il cliente):

- 3 tab: **Argomento libero** / **Polizza** / **Sinistro**.
- Argomento libero: input "Oggetto della richiesta" obbligatorio (es. "Richiesta preventivo casa").
- Polizza: lista delle polizze del cliente loggato (query su `titoli` filtrata da `get_my_cliente_ids()`), mostra `numero_titolo`, compagnia, ramo, `targa_telaio` se presente.
- Sinistro: lista dei sinistri del cliente (query su `sinistri`), mostra `numero_sinistro`, data e tipo.
- All'avvio della conversazione:
  - Inserisce in `chat_canali` con `ambito='contestuale'`, `entita_tipo` ∈ `argomento|titolo|sinistro`, `entita_id`, `visibile_cliente=true`, `creato_da=user.id`, `nome` autogenerato (`Polizza 12345 — RCA Auto`, `Sinistro S-2024-001`, oppure l'oggetto libero).
  - Chiama `findAllRelatedUsers(entita_tipo, entita_id)` per popolare `chat_canali_membri` con il cliente + Specialist + Consul + Sede collegati (riusa la libreria esistente).
  - Per "argomento libero" aggiunge automaticamente i referenti commerciali del cliente (Specialist, Consul, Sede del cliente).
- Pulsante "Nuova conversazione" in alto nella sidebar canali del cliente.

## 2. Ricerca conversazioni

Nella sidebar canali di `ClienteComunicazioni`:
- Input search con debounce 300 ms.
- Filtra lato client su `nome` canale + `entita_tipo`.
- In più, query separata su `chat_messaggi_interni` (filtrata via RLS sui canali del cliente) con `messaggio.ilike.%q%` → evidenzia i canali che contengono match e mostra uno snippet sotto il nome canale.
- Highlight del termine nella preview.

## 3. Header arricchito per Polizza/Sinistro

Estendere `ChatArea` (oppure wrappare in un nuovo `CanaleHeader` lato cliente) per mostrare, quando `chat_canali.entita_tipo='titolo'`:
- Badge `Polizza N° {numero_titolo}` + `Targa {targa_telaio}` se presente, compagnia e ramo.
- Quando `entita_tipo='sinistro'`: badge `Sinistro N° {numero_sinistro}` + tipo + data accadimento + polizza collegata (se valorizzata).
- Query: nuovo hook `useCanaleContextInfo(canale)` che, in base a `entita_tipo/id`, fa una select mirata su `titoli` o `sinistri`.
- Il header si aggiunge SOPRA la lista membri esistente, senza modificare la chat lato staff (componente nuovo solo lato cliente, oppure prop `showContextHeader` su `ChatArea`).

## File coinvolti

- **Nuovi**:
  - `src/components/cliente/NuovaChatClienteDialog.tsx`
  - `src/components/cliente/CanaleContextHeader.tsx` (badge polizza/sinistro)
- **Modificati**:
  - `src/pages/cliente/ClienteComunicazioni.tsx` (pulsante "Nuova", search input, integrazione header)
  - eventualmente `src/components/chat/ChatArea.tsx` per accettare un prop `headerSlot` opzionale (non rompe lo staff).

## Note tecniche

- Riuso di `findAllRelatedUsers` da `src/lib/findRelatedUsers.ts` per popolare i membri (memoria "chat-contestuale-sync-membri").
- `targa_telaio` esiste già su `titoli` (verificato).
- Nessuna modifica DB/RLS: le policy esistenti su `chat_canali`/`chat_canali_membri` permettono già al cliente di creare canali contestuali con `visibile_cliente=true` (il pattern è già usato lato staff).
- Tutti i tag `data-tour` esistenti restano invariati; aggiungeremo `cl-chat-new` e `cl-chat-search` per estendere il tour in futuro.
