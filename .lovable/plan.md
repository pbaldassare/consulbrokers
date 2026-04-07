

## Piano: Integrazione MondoAppalti.it per Ricerca Bandi Assicurativi

### Obiettivo
Aggiornare la Edge Function `cerca-bandi` per navigare su **mondoappalti.it**, effettuare login con le credenziali fornite, e cercare gare d'appalto rilevanti per broker assicurativi, con filtri per regione e data.

### Modifiche

**1. Nuovi Secrets**
- `MONDOAPPALTI_USER` = `TR02369`
- `MONDOAPPALTI_PASSWORD` = `Piemonte2026!`

Salvati come secret Supabase per sicurezza (non hardcoded).

**2. Aggiornare `supabase/functions/cerca-bandi/index.ts`**
- Cambiare il prompt Browser Use per navigare `mondoappalti.it`
- Aggiungere step di login (utente + password)
- Costruire il task con focus su parole chiave settore assicurativo/broker: "assicurazione", "brokeraggio", "polizza", "intermediazione assicurativa", "servizi assicurativi", "RCA", "RC professionale"
- Filtri per regione e intervallo date di pubblicazione
- Il browser AI farà: login → ricerca → estrazione risultati → output JSON

**3. Aggiornare `src/pages/BandiPubbliciPage.tsx`**
- Aggiungere un selettore "Fonte" (MondoAppalti come default, predisposto per future fonti)
- Aggiungere parole chiave predefinite per il settore assicurativo come chip cliccabili: "Servizi assicurativi", "Brokeraggio", "Polizze", "RCA", "RC Professionale", "Intermediazione"
- Migliorare i filtri regione/data già presenti (sono già funzionanti)

### Flusso Browser Use

```text
1. Vai su mondoappalti.it
2. Login con credenziali (username + password)
3. Cerca bandi con keyword assicurativa + filtri regione/data
4. Estrai risultati: titolo, ente, importo, scadenza, link, categoria
5. Restituisci JSON strutturato
```

### File coinvolti

| File | Azione |
|------|--------|
| Secrets `MONDOAPPALTI_USER`, `MONDOAPPALTI_PASSWORD` | Aggiungere |
| `supabase/functions/cerca-bandi/index.ts` | Aggiornare prompt per mondoappalti.it con login |
| `src/pages/BandiPubbliciPage.tsx` | Aggiungere chip keywords assicurative + selettore fonte |

### Sicurezza
Le credenziali non saranno mai nel codice sorgente, solo nei secrets Supabase accessibili dalla Edge Function.

