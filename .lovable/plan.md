
# E/C Cliente + Mail automatica messa a cassa

## Obiettivo

1. In **E/C Cliente** la riga appare alla **creazione della polizza** e mostra **solo il premio in corso** (rata firma / rata corrente), **non** le quietanze future.
2. Quando la rata viene **messa a cassa**, passa automaticamente nello **Storico E/C Cliente** (già governato da `data_messa_cassa`).
3. Contestualmente alla messa a cassa, parte una **mail automatica formale** all'**ente finale** che gestisce la polizza (rapporto specifico: agenzia / direzione / broker / sede compagnia), all'indirizzo `email_messe_a_cassa` configurato su quel rapporto.

## Destinatario mail (catena di risoluzione)

Si usa SEMPRE l'indirizzo dell'**ente finale del rapporto** legato alla polizza, non un default centrale:

1. `compagnia_rapporti.email_messe_a_cassa` del rapporto agganciato al titolo (`titoli.compagnia_rapporto_id`) — PRIMA SCELTA, è l'agenzia/direzione/broker effettivo.
2. Fallback: `compagnie.email_messe_a_cassa` della compagnia madre del rapporto.
3. Fallback finale: `pscarpelli@consulbrokers.it` (default già backfillato).

Se mancano entrambi → log di anomalia, niente invio silente.

## E/C Cliente — filtro "solo premio in corso"

Stato attuale (memoria `ec-clienti-messa-a-cassa`): l'E/C Cliente vivo filtra titoli con `data_messa_cassa IS NULL`. Va aggiunto un filtro per **escludere le quietanze future non ancora maturate**:

- Mostra solo titoli dove:
  - `data_messa_cassa IS NULL` (non ancora incassata), **E**
  - la rata è "corrente" → `data_decorrenza_rata <= today` (o, equivalentemente, `sostituisce_polizza IS NULL` per la rata madre **oppure** la rata sostituente con decorrenza già iniziata).
- Le rate successive (quietanze future generate da `genera_quietanza_su_messa_cassa`) restano invisibili in E/C cliente finché non diventano correnti.

Modifiche concentrate in:
- `src/pages/contabilita/ECClientiContabPage.tsx` (lista)
- `src/lib/ec-cliente-pdf.ts` (PDF)
- eventuale RPC server-side se usata

## Mail automatica messa a cassa

### Trigger

Lato applicativo, nel punto in cui oggi viene applicata la messa a cassa:
- bottone **Incassa / Garantito** in `src/pages/TitoloDetail.tsx`
- azione bulk in `src/pages/PortafoglioCaricoPage.tsx`
- helper `src/lib/annullaMessaACassa.ts` (NON deve inviare nulla in annullamento)

Dopo l'UPDATE che setta `data_messa_cassa` (e `stato='incassato'` per non-poliennali), si invoca l'edge function `send-messa-cassa-email` passando `titolo_id` e `modalita_pagamento`.

### Edge function `send-messa-cassa-email`

Nuova function in `supabase/functions/send-messa-cassa-email/index.ts`:

1. Carica titolo + cliente + compagnia + rapporto + sede + AE + specialist con una query unica.
2. Risolve destinatario secondo la catena (rapporto → compagnia → default).
3. Compone HTML brand-coerente (tema teal Consulnet).
4. Invia tramite l'infrastruttura email Lovable (`send-transactional-email` con nuovo template `messa-a-cassa-agenzia`) con `idempotencyKey = messa-cassa-${titolo.id}-${data_messa_cassa}` (riprovabile, non duplica).
5. Logga su `log_attivita` (entità `titolo`) e su `email_send_log`.
6. Errori non bloccano la messa a cassa (toast warning lato UI).

### Template email (transactional)

Nuovo template `messa-a-cassa-agenzia` in `supabase/functions/_shared/transactional-email-templates/messa-a-cassa-agenzia.tsx` con props dinamici:

- nome ente destinatario, cliente, CF/PIVA, compagnia, numero polizza, ramo/sottoramo, periodo rata, importo lordo, modalità pagamento, data messa a cassa, specialist, sede gestore.

Subject: `Comunicazione messa a cassa — Polizza {numero} — {cliente}`

Esempio di corpo già validato nel messaggio precedente.

## Esempio concreto (per verifica)

> **A:** `agenzia.milano@generali.it` (campo `email_messe_a_cassa` del rapporto "GENERALI – Agenzia Milano" su `compagnia_rapporti`)
> **Oggetto:** Comunicazione messa a cassa — Polizza 184667297 — ROSSI MARIO
>
> Spettabile GENERALI ITALIA — Agenzia di Milano,
>
> con la presente si comunica formalmente l'avvenuta **messa a cassa** del premio relativo alla polizza in oggetto:
>
> - Cliente: **ROSSI MARIO** (C.F. RSSMRA80A01F205X)
> - Compagnia: GENERALI ITALIA S.p.A.
> - Rapporto: Agenzia di Milano (cod. 0123)
> - Polizza n°: **184667297**
> - Ramo / Sottoramo: RC Auto / RCA
> - Rata di firma: 28/05/2026 – 28/05/2027
> - Importo lordo incassato: **€ 1.234,56**
> - Modalità di pagamento: **Bonifico bancario**
> - Data messa a cassa: 28/05/2026
> - Specialist: Mario Bianchi — Sede: Milano
>
> Si richiede cortese conferma di registrazione della presente messa a cassa nei vostri sistemi.
>
> Cordiali saluti,
> Consulbrokers S.p.A.

## Out of scope

- Email per **annullo** messa a cassa (eventuale follow-up).
- Email su rinnovi/quietanze future non ancora messe a cassa.
- Modifica della UI di E/C Cliente oltre al filtro "rata corrente".

## Riepilogo file

- **DB**: nessuna nuova tabella; usa `compagnia_rapporti.email_messe_a_cassa` e `compagnie.email_messe_a_cassa` già esistenti.
- **Nuovi**:
  - `supabase/functions/send-messa-cassa-email/index.ts`
  - `supabase/functions/_shared/transactional-email-templates/messa-a-cassa-agenzia.tsx` (+ registry update)
- **Modificati**:
  - `src/pages/TitoloDetail.tsx`, `src/pages/PortafoglioCaricoPage.tsx` (invoke dopo messa a cassa)
  - `src/pages/contabilita/ECClientiContabPage.tsx`, `src/lib/ec-cliente-pdf.ts` (filtro "rata corrente")
