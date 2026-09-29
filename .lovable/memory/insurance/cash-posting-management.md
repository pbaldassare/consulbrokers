---
name: Cash posting management
description: Messa a Cassa — la polizza è la prima rata incassabile
type: feature
---
# Messa a Cassa - Regole

- Si mette a cassa **la polizza** (prima rata) oppure una quietanza successiva / appendice.
- Porta lo stato del titolo da `attivo` (o `annullato` ripristinato) → `incassato` e valorizza `data_messa_cassa`, `data_pagamento`, `data_decorrenza_rinnovo`, `data_incasso`, `importo_incassato`.
- I bottoni **Incassa** e **Garantito** in `TitoloDetail` sono visibili quando `puoAprireIncasso` (stato `attivo` o `annullato`, senza cassa già chiusa, salvo poliennale/garantito aperto).
- Da **annullato**: `ripristinaPolizzaPerIncasso` riporta titolo `attivo` e `polizze.stato = attiva`, poi si apre il dialog. Niente quietanze da ricreare.
- Polizze **poliennali** (durata > 13 mesi) restano in stato `attivo` anche dopo la messa a cassa della rata corrente, perché hanno rate residue future.

## Protezione anti-doppio-incasso (DB)

Trigger `trg_prevent_double_messa_cassa` (BEFORE UPDATE su `titoli`, funzione `public.prevent_double_messa_cassa`):

- Blocca update che cambiano `data_messa_cassa` quando OLD era già non-null (eccetto poliennali attive).
- Blocca update che cambiano `data_incasso` quando stato era già `incassato` (eccetto poliennali).
- **Bypass admin**: `SET LOCAL app.bypass_messa_cassa_lock = 'on'` nella sessione (stessa convenzione di `lock_premi_storici`).
- Per reincassare una polizza già incassata (non-poliennale) serve prima **Annulla Incasso / Messa a Cassa** (admin). Per una polizza **annullata** si ripristina e si mette a cassa la stessa riga.
