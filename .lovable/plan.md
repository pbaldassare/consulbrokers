

## Piano: Fix creazione chat contestuale e visualizzazione utenti collegati

### Problemi identificati

1. **La creazione fallisce per prospect**: il trigger `validate_chat_canali_ambito` accetta solo `'cliente', 'trattativa', 'titolo', 'sinistro', 'argomento'` -- `'prospect'` non e' ammesso. Serve una migrazione per aggiungere `'prospect'` alla lista.

2. **Utenti non visibili**: quando il prospect non ha `user_id` (tutti i prospect nel DB hanno `user_id = null`), `findAllRelatedUsers` trova solo `assegnato_a` e lo staff ufficio, ma il riepilogo mostra "1 Prospect" perche' il ruolo e' mappato male. In realta' trova il produttore assegnato ma lo mostra come "prospect" nella UI.

3. **L'ufficio del prospect (05d27a37) non ha staff**: la query `addUfficioStaff` non trova nessuno perche' nessun profilo attivo ha quel `ufficio_id`. Il risultato e' 0 o 1 partecipanti (solo assegnato_a).

4. **Nessun feedback di errore**: il `createMutation.onError` mostra un generico "Errore nella creazione" senza dettagli. L'utente non capisce cosa sia andato storto.

### Modifiche

#### 1. Migrazione DB: aggiungere `'prospect'` al trigger

Aggiornare `validate_chat_canali_ambito` per accettare anche `'prospect'` come `entita_tipo`.

#### 2. `findRelatedUsers.ts` -- migliorare `resolveProspect`

- Anche se il prospect non ha `user_id`, aggiungere comunque il prospect come entita' di riferimento nel nome (gia' fatto)
- Se `assegnato_a` esiste, aggiungerlo con ruolo `"assegnato"` (gia' fatto, ma verificare che funzioni)
- Dopo lo staff ufficio del prospect, cercare anche trattative collegate e i LORO `assegnato_a` + staff ufficio

#### 3. `NuovaConversazioneDialog.tsx` -- miglioramenti

- **Errore dettagliato**: nel `onError` del mutation, mostrare il messaggio di errore reale dal DB
- **Mostrare la lista dei collegati anche se vuota con spiegazione**: se `findAllRelatedUsers` restituisce 0 utenti, mostrare un avviso "Nessun utente collegato trovato -- aggiungi partecipanti manualmente"
- **Se nessun utente e' collegato, non bloccare**: permettere la creazione anche con 0 auto-collegati se l'utente aggiunge manualmente

#### 4. `ChatArea.tsx` -- mostrare i membri del canale

- Aggiungere un header nel ChatArea che mostra i membri del canale corrente con ruolo e badge
- Query `chat_canali_membri` gia' presente, estenderla con join a `profiles` per mostrare nome + ruolo

### File coinvolti

| File | Azione |
|------|--------|
| Migrazione SQL | Aggiungere `'prospect'` al trigger `validate_chat_canali_ambito` |
| `src/lib/findRelatedUsers.ts` | Nessuna modifica necessaria (gia' corretto) |
| `src/components/chat/NuovaConversazioneDialog.tsx` | Error handling migliorato, feedback visivo per 0 collegati |
| `src/components/chat/ChatArea.tsx` | Header con lista membri + ruoli del canale attivo |

### Dettagli tecnici

- Migrazione: `CREATE OR REPLACE FUNCTION validate_chat_canali_ambito()` con `'prospect'` aggiunto alla lista
- ChatArea header: query `chat_canali_membri` con join `profiles(nome, cognome, ruolo)` per mostrare chip con nome + badge ruolo
- Error toast: `toast.error(err?.message || "Errore nella creazione")`

