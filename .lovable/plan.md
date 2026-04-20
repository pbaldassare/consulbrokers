

## Stato

Il fix è già applicato nel codice (linee 155-200 di `send-email/index.ts`):
1. STEP 1 — branding caricato prima → `finalFrom = "ConsulNet <noreply@iaconnect.it>"`
2. STEP 2 — fallback solo se ancora vuoto
3. STEP 3 — sandbox check sul `finalFrom` definitivo → `isSandbox = false`

## Cosa serve fare adesso

Solo **1 azione**: deployare la edge function aggiornata e fare un test live.

### Step 1 — Deploy
Deploy di `send-email` (la modifica è in repo ma va pushata su Supabase).

### Step 2 — Test reale
Invio una mail di test direttamente alla edge function con:
- `to: paolo.baldassare@gmail.com`
- `apply_branding: true`
- `subject: Test post-fix`

### Step 3 — Verifica log
Leggo i log della edge function subito dopo il test per confermare:
- `from: ConsulNet <noreply@iaconnect.it>` ✓
- `to: paolo.baldassare@gmail.com` (NON `info@iaconnect.it`) ✓
- `sandbox_redirect: false` ✓
- `delivery_status: delivered` (dal polling Resend a 3.5s)

### Step 4 — Risposta all'utente
- Se `delivered` con destinatario corretto: ✅ "Mail inviata, chiedi a Paolo di controllare anche Spam la prima volta (dominio nuovo)"
- Se ancora `info@iaconnect.it`: indagine ulteriore (cache deploy, branding DB sbagliato)
- Se `bounced`: mostro motivo esatto da Resend

## File toccati

**Nessuna modifica al codice** — il fix è già presente. Solo deploy + test + verifica log.

