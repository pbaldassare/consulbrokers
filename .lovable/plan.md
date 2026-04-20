

## Obiettivo

Trasformare la pagina **Template Email** da semplice anteprima a **centro operativo di test invio**, dove l'admin può:
1. **Inviare realmente** un'email di test usando il template scelto (via Resend già configurato)
2. **Personalizzare** logo intestazione, firma, colori del wrapper HTML
3. **Allegare PDF autocompilanti** generati dal sistema (es. preventivo, polizza, quietanza) a partire dai dati del cliente/polizza selezionati

Tutto in modalità test (mittente `onboarding@resend.dev`, destinatari = email account Resend o email custom inserita), pronto a passare a produzione cambiando solo il dominio mittente.

## Stato attuale (verificato)

- `TemplatePage.tsx` mostra template + anteprima con dati reali (cliente + polizza già selezionabili nel modal "Anteprima")
- `template_email` ha solo `oggetto` + `corpo` (testo con placeholder)
- `sendEmail()` helper già pronto → invoca edge function `send-email` (Resend)
- Nessun branding (logo/firma/header HTML) attualmente applicato
- Nessuna generazione PDF allegata

## Architettura proposta

```text
┌─ Template Email page ────────────────────────────────────┐
│  [Lista template] → [Anteprima esistente] → INVIA TEST  │
│                              │                           │
│                              ▼                           │
│                      [Dialog INVIO TEST]                 │
│                      • Destinatario (email)              │
│                      • Cliente + Polizza (già scelti)    │
│                      • ☑ Allega PDF (quale doc)          │
│                      • Anteprima HTML rendered           │
│                      • [Invia]                           │
└──────────────────────────────────────────────────────────┘
                               │
                               ▼
              edge function "send-email"  (estesa)
              • applica wrapper HTML (logo + firma)
              • genera PDF on-demand (se richiesto)
              • allega via Resend `attachments`
              • invia
```

## Modifiche tecniche

### 1. Tabella `email_branding` (1 riga, singleton)
Nuova tabella per personalizzazione globale:
- `logo_url` (text) — URL logo intestazione (caricato in storage `branding`)
- `colore_primario` (text, default `#0e7490` teal)
- `firma_html` (text) — firma in fondo (es. "Cordiali saluti, Sede di...")
- `intestazione_html` (text, opzionale) — intestazione legale
- `mittente_default` (text, default `ConsulNet <onboarding@resend.dev>`)
- RLS: solo admin scrive, tutti gli autenticati leggono

### 2. Nuova pagina/sezione "Branding email"
Tab aggiuntivo nella `TemplatePage.tsx` (o sotto `Impostazioni`):
- Upload logo (storage bucket `branding/`)
- Color picker per colore primario
- Editor testuale per firma e intestazione
- Anteprima live di come appare l'email wrapped

### 3. Wrapper HTML lato edge function
La function `send-email` viene **estesa** (non ricreata): se riceve `template_id` o flag `apply_branding: true`, prima dell'invio:
- Carica `email_branding`
- Wrappa il `html` in un layout responsive: header con logo + colore primario, body, footer con firma
- Sostituisce eventuali placeholder rimasti

Mantiene backward-compat: se ricevi solo `html` puro (come oggi), non wrappa.

### 4. Generazione PDF allegati
Nuova edge function `genera-pdf-template` (o estensione di `genera-distinta-pdf` già esistente):
- Input: `tipo` (`preventivo` | `polizza` | `quietanza` | `certificato`), `cliente_id`, `titolo_id`
- Usa libreria PDF (es. `pdf-lib` via Deno) per generare PDF formattato con:
  - Logo da `email_branding`
  - Dati reali da DB (clienti, titoli, compagnie, sede)
  - Layout standard assicurativo
- Restituisce base64 (per allegare) o URL temporaneo

In v1 implemento **3 tipi**: `preventivo`, `quietanza`, `riepilogo_polizza`. Gli altri seguono lo stesso pattern.

### 5. Dialog "Invia test" in `TemplatePage.tsx`
Nuovo componente `SendTestEmailDialog`:
- Pre-popola destinatario con email del cliente (modificabile)
- Mostra anteprima HTML **wrapped** (chiama una RPC o edge function di "preview render")
- Checkbox: "Allega PDF" → dropdown tipo PDF
- Bottone "Invia" → chiama `sendEmail({ to, subject, html, attachments, apply_branding: true })`
- Toast esito + log su `log_attivita`

### 6. Helper `sendEmail` esteso
`src/lib/sendEmail.ts` aggiunge campi opzionali:
- `attachments?: { filename: string; content: string /* base64 */ }[]`
- `apply_branding?: boolean`
- `template_id?: string`

### 7. Edge function `send-email` aggiornata
- Accetta nuovi campi
- Se `apply_branding`: carica branding e wrappa HTML
- Inoltra `attachments` a Resend (Resend supporta nativamente: `[{ filename, content }]`)

## File toccati

**Nuovi:**
- `supabase/migrations/<ts>_email_branding.sql` — tabella + bucket `branding`
- `supabase/functions/genera-pdf-template/index.ts` — generatore PDF
- `src/components/template/SendTestEmailDialog.tsx` — dialog invio test
- `src/components/template/EmailBrandingTab.tsx` — config branding

**Modificati:**
- `src/pages/TemplatePage.tsx` — bottone "Invia test" + tab Branding
- `src/lib/sendEmail.ts` — campi attachments/apply_branding
- `supabase/functions/send-email/index.ts` — wrapper HTML + attachments

## Cosa NON cambia

- Schema esistente `template_email` / `template_categorie`
- Helper `sendEmail` (resta backward-compatible)
- I 16 template già seedati (continuano a funzionare)
- Mittente Resend resta `onboarding@resend.dev` finché non si verifica un dominio reale

## Note

- **Test reali**: con `onboarding@resend.dev`, Resend permette invio **solo verso l'email del proprietario dell'account Resend**. Quindi i test funzionano verso quell'indirizzo; per inviare a clienti reali serve verificare un dominio (futura iterazione).
- **PDF in v1**: layout base professionale (logo + intestazione cliente + tabella dati + firma). Versioni più ricche (CGA allegate, multi-pagina) in iterazione successiva.
- **Sicurezza**: la dialog "Invia test" è accessibile solo da admin (controllo via `RoleGuard` o `permessi_json`).
- Il setup del **dominio mittente personalizzato** (es. `noreply@consulnet.iaconnect.it`) lo affrontiamo separatamente quando l'utente sarà pronto a verificare DNS su Resend.

