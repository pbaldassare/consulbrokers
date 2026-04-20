
L'utente vuole configurare Resend per inviare email automatiche e ha già fornito la API key (`re_ZzaCWNX7_...`).

Da memoria/contesto:
- Progetto già usa Supabase
- Esistono già edge functions
- Lovable Emails NON sembra configurato (no `send-transactional-email`, no `auth-email-hook`)

L'utente ha esplicitamente scelto Resend → rispetto la scelta, non propongo Lovable Emails.

## Piano

### 1. Salvataggio API Key
Aggiungo `RESEND_API_KEY` come secret Supabase tramite tool. (La chiave fornita NON va hardcodata nel codice.)

### 2. Edge Function `send-email` (nuova)
- `supabase/functions/send-email/index.ts`
- Riceve `{ to, subject, html, from? }` con validazione Zod
- Chiama Resend via `https://api.resend.com/emails` con `Authorization: Bearer ${RESEND_API_KEY}`
- CORS abilitato, JWT verification OFF (per chiamate sia client che server)
- Default sender: `onboarding@resend.dev` (dominio test Resend) finché l'utente non verifica un dominio

### 3. Helper client `src/lib/sendEmail.ts`
Wrapper che chiama `supabase.functions.invoke("send-email", ...)` per uso da qualsiasi pagina/feature

### 4. Config
Aggiungere `[functions.send-email] verify_jwt = false` in `supabase/config.toml`

## Casi d'uso (da implementare on-demand quando l'utente lo chiederà)
- Notifica creazione area riservata cliente (con credenziali)
- Notifica scadenza polizza
- Conferma reset password (custom)
- Invio documenti/preventivi al cliente

In questa iterazione installo solo l'infrastruttura. Poi l'utente indicherà quali trigger collegare.

## File toccati
**Nuovi:**
- `supabase/functions/send-email/index.ts`
- `src/lib/sendEmail.ts`

**Modificati:**
- `supabase/config.toml` — registra `verify_jwt=false` per `send-email`

**Secret:**
- `RESEND_API_KEY` (da aggiungere — chiederò conferma all'utente prima)

## Note
- Il dominio mittente sarà `onboarding@resend.dev` finché non viene verificato un dominio reale su resend.com (es. `noreply@consulnet.iaconnect.it`). Glielo segnalo a fine setup.
- La chiave fornita nel messaggio NON viene scritta nei file: viene salvata come secret cifrato.
