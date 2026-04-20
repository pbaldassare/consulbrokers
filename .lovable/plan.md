

## Diagnosi (CONFERMATA dai log della edge function)

L'email NON arriva a Paolo perché la edge function `send-email` la sta dirottando in modalità sandbox a `info@iaconnect.it`. Log Resend confermano:

```
to: "info@iaconnect.it"
subject: "[TEST → paolo.baldassare@gmail.com] …"
sandbox_redirect: true
delivered ✓
```

Quindi Resend la consegna correttamente… ma all'indirizzo sbagliato.

## Causa esatta del bug

In `supabase/functions/send-email/index.ts`:

```ts
let finalFrom = from || "ConsulNet <onboarding@resend.dev>";   // riga 149 — DEFAULT sandbox
...
const isSandbox = /onboarding@resend\.dev/i.test(finalFrom);   // riga 155 — calcolato PRIMA del branding
if (isSandbox) { /* dirotta a SANDBOX_OWNER (=info@iaconnect.it) */ }
...
if (apply_branding) {                                          // riga 168
  ...
  if (!from && branding?.mittente_default) {
    finalFrom = branding.mittente_default;                     // sovrascrive con noreply@iaconnect.it (TROPPO TARDI)
  }
}
```

Il dialog di test invoca `sendEmail({ apply_branding: true, ... })` SENZA passare `from`. Quindi:
1. `finalFrom` parte come `onboarding@resend.dev` (default sandbox)
2. `isSandbox` viene calcolato → `true` → tutti i destinatari dirottati a `info@iaconnect.it`
3. Solo DOPO il branding sovrascrive `finalFrom` con `noreply@iaconnect.it`
4. Risultato: la mail parte da `noreply@iaconnect.it` (verificato) ma è indirizzata a `info@iaconnect.it`, non a Paolo

## Fix

**File: `supabase/functions/send-email/index.ts`**

Spostare il caricamento del branding (e quindi la risoluzione di `finalFrom`) **prima** del calcolo `isSandbox` e della logica di redirect sandbox. In pratica:

1. Risolvere `finalFrom` definitivo (con eventuale `mittente_default` dal DB) per primo
2. Calcolare `isSandbox` sul `finalFrom` definitivo
3. Solo se davvero il from finale è `onboarding@resend.dev` → dirotta a sandbox

Risultato atteso: con `mittente_default = "ConsulNet <noreply@iaconnect.it>"` salvato in DB, `isSandbox = false` → la mail va davvero a `paolo.baldassare@gmail.com`.

Aggiungo anche un log finale chiaro:
```
[send-email] Final from=…, to=…, sandbox_redirect=false
```

## File toccati

**Modificato (solo uno):**
- `supabase/functions/send-email/index.ts` — riordino logico: branding/from PRIMA, sandbox check DOPO

**Nessuna modifica a:** UI, DB, altre edge function.

## Verifica post-deploy

1. L'utente clicca "Invia test" → log mostreranno `to: "paolo.baldassare@gmail.com"` e `sandbox_redirect: false`
2. Paolo riceve l'email su Gmail (controllare anche Spam la prima volta — dominio nuovo, reputazione iniziale)
3. Risposta API includerà `delivery_status: "delivered"` con il vero destinatario

