

## Problema

Nella sidebar Comunicazioni → Interna → Diretti vedi 3 voci tutte etichettate "Conversazione" invece del nome del collega (Paola Scarpelli, Admin Consul).

## Causa (verificata sul DB)

I dati esistono — i 3 canali diretti sono con Paola Scarpelli (2 chat) e Admin Consul (1 chat). La logica `getDisplayName` in `CanaliSidebar.tsx` (riga 122-125) è già corretta: legge `chat_canali_membri` e mostra `nome cognome` del membro che NON sei tu.

Il join però non funziona: la query (riga 61) usa
```
chat_canali_membri(user_id, profiles:user_id(nome, cognome))
```
La FK di `chat_canali_membri.user_id` punta ad `auth.users.id`, non a `profiles.id` direttamente, quindi Supabase non riesce a risolvere automaticamente la relazione embedded `profiles:user_id(...)` e ritorna `null`. Risultato: il fallback "Conversazione" scatta sempre.

## Fix

Stessa strategia già usata per le entità contestuali (clienti/titoli/trattative): faccio una **seconda query separata** su `profiles` con gli `user_id` dei membri delle chat dirette, poi mappo in client.

Modifico solo `src/components/chat/CanaliSidebar.tsx`:

1. Rimuovere il join non funzionante: `chat_canali_membri(user_id)` (senza embed profiles)
2. Aggiungere una `useQuery` "membri_nomi" che:
   - Raccoglie tutti gli `user_id` dei membri delle chat di tipo `diretto` (escludendo l'utente corrente)
   - Fa una `select id, nome, cognome from profiles where id in (...)`
   - Restituisce una mappa `{ userId: "Nome Cognome" }`
3. Aggiornare `getDisplayName`: per chat dirette, prendere il primo membro `!== userId`, cercare nella mappa e tornare il nome; fallback "Conversazione".

Stesso fix applicato a `ClienteComunicazioni.tsx` solo se serve (lì le chat sono contestuali, l'etichetta usa già `nome` del canale o entità — non c'è il problema).

## File toccati

- `src/components/chat/CanaliSidebar.tsx` (unico file)

## Verifica

Dopo il fix, sulla pagina `/comunicazioni` tab "Interna" → filtro "Diretti", al posto di "Conversazione" vedrai:
- Paola Scarpelli
- Paola Scarpelli  
- Admin Consul

Inoltre la ricerca per nome nella sidebar funzionerà davvero (oggi cerca su "Conversazione").

