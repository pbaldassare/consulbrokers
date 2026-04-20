

## Diagnosi (FATTA — non più ipotesi)

Ho appena interrogato Resend in tempo reale e il DB:

✅ **Dominio `iaconnect.it`**: status `verified`, sending `enabled`
✅ **Tutti i 3 record DNS verificati**: DKIM (TXT), SPF MX, SPF TXT — tutti `verified`
✅ **Mittente configurato in DB**: `ConsulNet <noreply@iaconnect.it>` — corretto
✅ **Edge function `send-email`**: codice corretto, fa il polling delivery status

**Il problema NON è il dominio.** Resend dice che è tutto a posto e accetta i messaggi. Eppure non arrivano al destinatario.

## Cause reali residue (in ordine di probabilità)

1. **🔴 PIÙ PROBABILE — Suppression list di Resend / SES**: l'indirizzo `paolo.baldassare@gmail.com` (notare il typo: `baldassare` invece di `baldassarre`?) potrebbe aver generato un hard bounce in un test precedente → Amazon SES (che Resend usa sotto) lo ha messo in suppression list permanente → ogni nuovo invio viene **silenziosamente droppato** dopo l'accept iniziale.
2. **🟡 Reputazione iniziale del dominio**: `iaconnect.it` è verificato da poco (22 ottobre). Gmail può mettere in quarantena/spam le prime decine di mail finché la reputazione non si consolida → controllare cartella **Spam** di Paolo.
3. **🟡 Typo nell'indirizzo**: nello screenshot dell'utente è scritto `paolo.baldassare@gmail.com` — verificare se esiste davvero o è `baldassarre` con doppia r.

## Cosa faccio (3 azioni concrete)

### 1. Diagnosi automatica delivery — leggo direttamente da Resend
Estendo `check-resend-domain` (o nuova `check-email-status`) per accettare un parametro `email` e:
- Cercare gli ultimi messaggi inviati a quell'indirizzo
- Restituire stato reale: `delivered`, `bounced` (con motivo: hard/soft, codice SMTP), `complained`, `suppressed`
- Se hard bounce → mostrare nell'UI con motivo esatto

### 2. Pulsante "Diagnostica indirizzo" nel dialog di test
Nel `SendTestEmailDialog`, accanto al campo destinatario, aggiungo pulsante 🔍 che chiama il nuovo endpoint e mostra:
- ✅ "Ultimi 5 invii: tutti delivered" → problema lato client
- ❌ "BOUNCED il 18/04: 550 5.1.1 user unknown" → indirizzo errato/inesistente
- ⚠️ "In suppression list dal 15/04 (hard bounce)" → serve rimozione manuale

### 3. Rimozione suppression automatica
Se l'indirizzo è in suppression e l'utente conferma "so che è valido, ritenta", chiamo `DELETE https://api.resend.com/contacts/{email}` per rimuoverlo dalla lista (Resend espone l'API per gestire le suppression).

### 4. Logging migliorato lato delivery
Nella `send-email` espongo nella response anche eventuali campi `bounce`/`complained` di Resend appena disponibili, così l'UI può mostrare un toast tipo "Email accettata MA bounce in arrivo".

## File toccati

**Modificati:**
- `supabase/functions/check-resend-domain/index.ts` — aggiungo modalità "lookup per email" che restituisce ultimi messaggi + suppression status
- `src/components/template/SendTestEmailDialog.tsx` — pulsante diagnostica accanto al destinatario, banner risultato

**Nuovi:** nessuno (riuso e estendo l'esistente)

**Nessuna modifica a:** DB, migrations, send-email (è già OK).

## Cosa l'utente vedrà

1. Subito dopo l'implementazione: cliccando 🔍 accanto a `paolo.baldassare@gmail.com` saprà in 1 secondo **perché** non arriva (bounce / suppression / spam / typo)
2. Se è suppression: pulsante "Rimuovi da suppression" che lo riabilita
3. Se è typo o indirizzo inesistente: messaggio chiaro per correggerlo

## Nota importante

Prima di tutto questo lavoro, **chiedo all'utente di verificare 2 cose in 30 secondi**:
- Il destinatario è davvero `paolo.baldassare` (una sola R) o `paolo.baldassarre` (due R)?
- Paolo ha controllato la cartella **Spam/Promozioni/Tutti i messaggi** di Gmail?

Se la risposta a una di queste due risolve il problema, evitiamo del tutto lo sviluppo.

