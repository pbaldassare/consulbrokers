

## Piano: Pulsante "Attiva Area Riservata" con anteprima email e scelta tipo accesso

### Cosa cambia

**1. Ristrutturazione del flusso di attivazione (`AreaRiservataCard` in `ClienteDetail.tsx`)**

Il pulsante attuale viene rinominato **"Attiva Area Riservata"** e il flusso diventa:
- Click → si apre un **Dialog** con:
  - **Anteprima email** di attivazione (template HTML di default, personalizzabile in futuro)
  - **Select** tipo accesso: Sola Lettura (default) / Completa
  - **Pulsante "Invia e Attiva"**
- L'email mostra: logo CBnet, messaggio di benvenuto, credenziali (email + password Consul123!), link al portale
- La conferma: crea l'utente (se non esiste), salva il tipo, e invia l'email

**2. Configurazione dominio email**

Per inviare email serve un dominio configurato. Verrà mostrato il dialog di setup email domain per configurarlo. Dopo la configurazione:
- Scaffold dei template email transazionali per l'invio dell'email di attivazione
- Edge function dedicata per l'invio dell'email di attivazione area riservata

**3. Template email di default**

Email di attivazione con:
- Header con logo CBnet
- Testo: "La tua area riservata è stata attivata"
- Credenziali: email + password di default
- Link al portale cliente
- Footer con dati agenzia

**4. Edge Function `send-activation-email`**

Nuova edge function che:
- Riceve `cliente_id`, `tipo_accesso`, `email`, `nome`
- Compone l'HTML dell'email con le credenziali
- Invia tramite l'infrastruttura email di Lovable

### Step di implementazione

1. **Setup dominio email** — configurare il dominio per l'invio
2. **Scaffold email transazionale** — template per email di attivazione
3. **Creare edge function `send-activation-email`** — invio email con credenziali
4. **Modificare `AreaRiservataCard`** in `ClienteDetail.tsx`:
   - Rinominare pulsante in "Attiva Area Riservata"
   - Aggiungere Dialog con anteprima email + select tipo
   - Default tipo = `sola_lettura`
   - Al click "Invia e Attiva": crea utente → salva tipo → invia email
5. **Deploy edge function**

### File coinvolti
- **Nuovo**: `supabase/functions/send-activation-email/index.ts`
- **Modifica**: `src/pages/ClienteDetail.tsx` — nuovo Dialog con anteprima email e flusso attivazione

### Prerequisito: dominio email
Per prima cosa serve configurare un dominio email. Dopo l'approvazione del piano, verrà mostrato il dialog di configurazione.

