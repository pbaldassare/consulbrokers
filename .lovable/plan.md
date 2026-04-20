

L'utente ha inviato un test a `paolo.baldassare@gmail.com` ma non è arrivata. Il sistema in modalità sandbox Resend (`onboarding@resend.dev`) **non può consegnare a destinatari esterni** — solo a `info@iaconnect.it` (proprietario account Resend). Il fix precedente reindirizza già automaticamente a `info@iaconnect.it`, quindi la mail dovrebbe essere arrivata lì, non a Paolo.

Verifico nei log edge function per confermare cosa è successo realmente.

## Diagnosi

**Causa**: Limite invalicabile della modalità sandbox Resend. Anche col redirect attivo, la mail arriva a `info@iaconnect.it` (con oggetto `[TEST → paolo.baldassare@gmail.com] ...`), **mai a Paolo direttamente**.

L'unica soluzione per consegnare davvero a Paolo (o a qualsiasi cliente reale) è **verificare un dominio su Resend**.

## Opzioni proposte

### Opzione A — Verifica `iaconnect.it` su Resend (consigliata)
Tu possiedi già il dominio (custom domain progetto = `consulnet.iaconnect.it`).
1. Tu vai su [resend.com/domains](https://resend.com/domains) → Add Domain → `iaconnect.it`
2. Resend ti dà 3-4 record DNS (SPF, DKIM, DMARC) da aggiungere sul tuo provider DNS
3. Quando Resend mostra "Verified" (5min-24h), io aggiorno il default mittente a `noreply@iaconnect.it` (o `consulnet@iaconnect.it`)
4. Da quel momento le mail partono verso QUALSIASI destinatario reale

**Cosa faccio io dopo la verifica:**
- Aggiorno `email_branding.mittente_default` → `ConsulNet <noreply@iaconnect.it>`
- Rimuovo la logica sandbox-redirect dalla edge function (o la lascio come fallback se mittente è ancora `onboarding@resend.dev`)
- Test invio reale a Paolo per confermare

### Opzione B — Test continuati su `info@iaconnect.it`
Resta in sandbox. Ogni test arriva a `info@iaconnect.it` con prefisso oggetto `[TEST → ...]`. Non puoi mandare a Paolo né a clienti reali finché non passi all'opzione A.

### Opzione C — Avviso UI più esplicito
Aggiungo un banner giallo nel dialog "Invia test" che dice chiaramente: "⚠️ In modalità test, l'email arriverà a `info@iaconnect.it` indipendentemente dal destinatario inserito. Per inviare a destinatari reali, verifica il dominio su Resend."

## Cosa propongo di fare ora

**Step 1** (subito, opzione C): aggiungo il banner di avviso nel `SendTestEmailDialog.tsx` per evitare confusione.

**Step 2** (quando confermi): aggiungo nella tab **Branding email** una guida step-by-step "Verifica dominio Resend" con i campi DNS da copiare e un check-status. Quando il dominio è verificato, basta cambiare il mittente nel form Branding e il sistema esce automaticamente da sandbox.

## File toccati

**Modificati:**
- `src/components/template/SendTestEmailDialog.tsx` — banner giallo "modalità sandbox attiva, destinatario forzato a info@iaconnect.it"

**Nessuna modifica a:**
- Edge function (la logica redirect funziona già correttamente)
- Database / migrations

## Note
- Per confermare che il sistema funziona: controlla la casella `info@iaconnect.it` — la mail di test inviata a Paolo dovrebbe esserci con oggetto prefissato `[TEST → paolo.baldassare@gmail.com]`. Se non c'è nemmeno lì, c'è un altro problema e indagherò sui log edge.
- L'unica via per inviare davvero a Paolo è verificare un dominio. Suggerisco `iaconnect.it` perché è già il tuo.

