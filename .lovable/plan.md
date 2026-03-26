

## Piano: Collegare Polizze ai Clienti, Triplicare Dati, Aggiungere Enti

### Problema attuale
- Le polizze (`titoli`) usano `cliente_id` (riferimento a `profiles`/auth users) ma **non** `cliente_anagrafica_id` (riferimento alla tabella CRM `clienti`)
- Solo 230 polizze, senza relazioni realistiche con i clienti CRM
- Nessun "ente" (ente pubblico, ASL, comune, ecc.) tra i clienti
- Nessuna relazione azienda-privato (`clienti_relazioni`)

### Cosa cambia

**1. Migrazione DB: aggiungere "ente" come tipo_cliente**
- Aggiornare il trigger `validate_clienti_tipo` per accettare `'privato', 'azienda', 'ente'`

**2. Aggiornamento seed-demo-data (Edge Function)**

| Sezione | Modifica |
|---|---|
| **Clienti** | Aggiungere ~30 enti (ASL, Comuni, Province, Regioni, Universita, INPS, INAIL, ecc.) con dati completi (ragione sociale, CF azienda, P.IVA, SDI, PEC, referente, indirizzo sede, settore, codice ATECO) |
| **Titoli** | Passare da 230 a **690 polizze**. Ogni polizza viene collegata a un record `clienti` tramite `cliente_anagrafica_id`. Distribuzione realistica: alcuni clienti hanno 1 polizza, alcuni 3-5, alcuni grandi clienti/enti fino a 10-15 polizze |
| **Relazioni azienda-privato** | Creare ~40 record in `clienti_relazioni` che collegano privati ad aziende/enti come dipendenti, legali rappresentanti, referenti o soci |
| **Campi compilati** | Tutti i campi dei clienti vengono popolati: sesso, data/comune/provincia nascita, zona, indotto, settore, codice ATECO, stato_cliente, tipo_persona, fido credito/cauzioni per aziende/enti |

**3. Distribuzione polizze per tipo cliente**
- ~350 polizze su clienti privati (con casi di clienti con 1, 3, 5 polizze)
- ~200 polizze su aziende (con casi di aziende con 5-15 polizze)
- ~140 polizze su enti (con casi di enti con 10-20 polizze, realistico per ASL/Comuni)

### Dettagli tecnici

| File | Modifica |
|---|---|
| **Migrazione SQL** | `DROP/ADD` del trigger `validate_clienti_tipo` per includere `'ente'` |
| **`supabase/functions/seed-demo-data/index.ts`** | Sezione 3: aggiungere 30 enti con dati completi. Sezione 7: triplicare titoli a 690, usare `cliente_anagrafica_id` per collegare ai clienti CRM. Nuova sezione: inserire `clienti_relazioni` tra privati e aziende/enti |

### Note
- I vecchi titoli senza `cliente_anagrafica_id` non vengono toccati (il seed crea nuovi record)
- Per eseguire il seed aggiornato bisognera richiamare la Edge Function `seed-demo-data`
- Nessuna modifica al frontend, solo dati

