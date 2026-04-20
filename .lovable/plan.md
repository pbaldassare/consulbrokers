

## Diagnosi

L'utente ha confermato che `iaconnect.it` è "verificato su Resend", ma:
- **`email_domain--list_email_domains` → No domains configured**: nessun dominio gestito da Lovable Emails.
- **Le mail compaiono nella dashboard Resend ma non vengono consegnate al destinatario**: tipico sintomo di dominio in stato `pending`/`not_started`/`failure` sui record DNS lato Resend (DKIM, SPF, MX, return-path), oppure API key Resend non scoped sul dominio `iaconnect.it`.
- Il codice della edge function **funziona**: invia a Resend con `from: noreply@iaconnect.it` e Resend risponde 200 con un `id` (per questo l'utente le "vede sul server"). Ma Resend mette in coda → bounce silenzioso → mai recapitate.

Il `mittente_default` in DB è già `ConsulNet <noreply@iaconnect.it>` (corretto).

## Cause possibili (in ordine di probabilità)

1. **Dominio `iaconnect.it` su Resend non è realmente "Verified"** — potrebbe essere "Pending" o "Failure" per uno dei 3-4 record DNS richiesti (SPF TXT, DKIM CNAME, MX). L'utente vede "verde" su un solo record ma non su tutti.
2. **API key `RESEND_API_KEY` configurata su Lovable scoped su un dominio diverso** (o "Sending access: full access" mancante).
3. **Record SPF/DKIM mancanti** su `iaconnect.it` perché il sottodominio `consulnet.iaconnect.it` è già delegato altrove (custom domain Lovable) e potrebbe interferire con la propagazione DNS sul root.

## Cosa propongo di fare

### Step 1 — Diagnostica reale (subito, automatica)

Aggiungo logging dettagliato nella edge function `send-email`:
- Logga il `from` finale, lo status HTTP Resend e l'`id` risposta
- Dopo l'invio, fa un GET a `https://api.resend.com/emails/{id}` per leggere lo **stato reale** del messaggio (`delivered`, `bounced`, `complained`, `delivery_delayed`)
- Restituisce questo stato al frontend nella risposta del test → l'utente vede subito se è `bounced` e con quale motivo

Inoltre aggiungo un nuovo endpoint diagnostico **`check-resend-domain`** (edge function) che chiama `GET https://api.resend.com/domains` con la API key configurata e restituisce:
- Lista domini visibili dalla API key
- Per ognuno: status (`verified`/`pending`/`failed`), records DNS richiesti e quali stanno mancando

### Step 2 — UI di diagnostica nella pagina Branding Email

Nella tab **Branding Email** (`EmailBrandingTab.tsx`) aggiungo un pulsante **"Verifica configurazione Resend"** che:
- Chiama `check-resend-domain`
- Mostra in card lo stato reale di `iaconnect.it`: ✅ Verified / ⏳ Pending / ❌ Failed
- Se Failed/Pending: elenca i record DNS mancanti (Type, Name, Value) **da copiare e incollare sul provider DNS**
- Se Verified ma ancora bounce: link diretto al log dashboard Resend

### Step 3 — Fallback automatico al sandbox in caso di "from non valido"

Se Resend ritorna errore 403 con `validation_error` "domain not verified" sul `from` configurato, la edge function **automaticamente**:
- Logga warning chiaro
- Reinvia con `from: onboarding@resend.dev` redirezionando a `info@iaconnect.it`
- Restituisce al frontend `domain_not_verified: true` così l'UI mostra un alert rosso "Dominio non verificato — il sistema è ricaduto in sandbox. Vai in Branding → Verifica configurazione".

### Alternativa (se l'utente preferisce)

**Migrare a Lovable Emails** (gestito da Lovable, DNS auto-configurato): più affidabile, ma richiede di settare un sottodominio dedicato (es. `notify.iaconnect.it`) e abbandonare Resend. Da fare solo se l'utente lo richiede esplicitamente — per ora restiamo su Resend come pianificato.

## File toccati

**Modificati:**
- `supabase/functions/send-email/index.ts` — logging dettagliato, polling stato post-invio, fallback sandbox automatico
- `src/components/template/EmailBrandingTab.tsx` — sezione "Stato dominio Resend" con pulsante diagnostico e tabella record DNS mancanti

**Creati:**
- `supabase/functions/check-resend-domain/index.ts` — endpoint diagnostico GET su Resend API
- Nuova entry in `supabase/config.toml` per la nuova edge function (verify_jwt = true)

**Nessuna modifica a:** DB, migrations.

## Cosa l'utente vedrà dopo

1. Quando manda un test, oltre a "Mail inviata" vedrà anche **"Stato Resend: delivered/bounced/pending"** (status reale a 3-5 secondi dopo l'invio)
2. Nuovo pulsante **"Verifica dominio Resend"** in Branding Email che mostra esattamente quali record DNS mancano
3. Se il dominio è davvero rotto, alert chiaro che invita a sistemare i DNS (con i valori esatti pronti da copiare)

## Note

- Non posso interrogare Resend direttamente da qui (no tool dedicato), quindi la diagnosi precisa la fa la nuova edge function quando deployata.
- È molto probabile che il problema sia un record DKIM mancante o SPF non aggiornato sul DNS di `iaconnect.it`. La nuova UI lo evidenzierà immediatamente.

