---
name: Notifica messa a cassa email
description: Edge function notifica-messa-cassa-agenzia, risoluzione destinatario e bottone Reinvia in TitoloDetail
type: feature
---

# Notifica messa a cassa — email all'agenzia/compagnia

Edge function `notifica-messa-cassa-agenzia` (config.toml: `verify_jwt = false`)
invocata automaticamente dopo ogni messa a cassa (sia da `TitoloDetail` sia da
`MessaCassaDialog` bulk). Usa `send-email` (Resend) per inviare la comunicazione
formale.

## Risoluzione destinatario (in ordine)
1. `compagnia_rapporti.email_messe_a_cassa`
2. `compagnie.email_messe_a_cassa`
3. Fallback hard-coded: `pscarpelli@consulbrokers.it`

## Campi titolo letti
`numero_titolo, riga, premio_lordo, importo_incassato, data_messa_cassa,
data_pagamento, tipo_pagamento, banca_pagamento, garanzia_da, garanzia_a,
data_competenza, ae_anagrafica_id` (NB: il campo è `ae_anagrafica_id`, non
`account_executive_id`).

## UI
- Invocazione automatica fire-and-forget post-messa-a-cassa con `toast.warning`
  in caso di errore (visibile, ma non blocca l'incasso).
- Bottone **"Reinvia notifica"** (icona Mail) nella card Operazioni di
  `TitoloDetail`, abilitato solo se `data_messa_cassa` valorizzato.
  Mostra toast con il destinatario risolto, invalida `log-attivita`.

## Testo intro (formale, mezzo parametrizzato)
`In data odierna abbiamo incassato per Vostro conto a mezzo {mezzo} il seguente premio che vi accrediteremo al netto delle provvigioni come da accordi:`

`{mezzo}` da `tipo_pagamento` (Bonifico, POS / Carta, Assegno, Contanti, …).
Bonifico/garantito/costi Consulbrokers/compensazione → «Bonifico».
Al plurale: «i seguenti premi». Provvigioni una sola volta: riga nel dettaglio
titolo (singola) oppure totale in fondo tabella (più polizze). Non ripetere il
blocco «Totale provvigioni maturate» sotto la scheda singola.

## Log
Ogni invio crea entry in `log_attivita` con `azione = 'notifica_messa_cassa_inviata'`,
`dettagli_json = { destinatario, oggetto, send_id }`.
