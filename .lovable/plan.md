

## Quadro reale di aprile 2026 (verificato sul DB)

Solo **2 titoli** sono stati messi a cassa in aprile 2026:

| # | Numero titolo | Premio | Stato | Data MaC | Provvigione generata | Movimenti contabili |
|---|---|---|---|---|---|---|
| 1 | 332434490 | €784 | attivo | 16/04/2026 | €23,78 (non pagata) | 0 |
| 2 | 332437574 | €300 | sospeso | 15/04/2026 | €35,33 (non pagata) | 0 |

Totale premio: **€1.084** (= esattamente il valore "Incassi del Mese" che vedi sulla dashboard).

✅ Nessuna provvigione è già pagata → l'annullamento è sicuro
✅ Nessun movimento contabile collegato → niente da pulire lì
✅ Le 3 polizze legacy intoccabili (204366651 / 6131402092 / RCM00010074404) NON sono in questa lista

## Cosa farò

Esiste già la funzione `src/lib/annullaMessaACassa.ts` (usata in produzione dal pulsante "Annulla Messa a Cassa" nel dettaglio titolo), che per ogni titolo:

1. Verifica che non ci siano provvigioni pagate (qui OK, nessuna lo è)
2. Elimina le provvigioni `pagata=false` collegate
3. Elimina movimenti contabili collegati (qui nessuno)
4. Resetta sul titolo: `stato='attivo'`, `data_messa_cassa=null`, `data_incasso=null`, `importo_incassato=null`, `data_pagamento=null`, `tipo_pagamento=null`, `banca_pagamento=null`, `conferimento_gestito=false`, `fondi_ricevuti=true`
5. Logga l'attività in timeline (`azione='annulla_messa_a_cassa'`, severity warning)

Per il reset di aprile 2026 eseguirò la **stessa identica logica via SQL diretto** (1 sola operazione idempotente, no edge function necessaria) sui 2 titoli identificati.

⚠️ Nota sul titolo #2 (332437574): era `sospeso` prima della messa a cassa? Lo riporterò comunque a `attivo` per allinearmi alla logica della funzione esistente. Se volevi ripristinarlo a `sospeso`, dimmelo.

## Cosa NON tocco

- Le 3 polizze legacy (204366651 / 6131402092 / RCM00010074404)
- Qualunque polizza con `data_messa_cassa < 2026-04-01` o `> 2026-04-30`
- Provvigioni già pagate (non ce ne sono comunque)
- Comunicazioni/email/notifiche/sinistri/trattative/documenti

## Verifica post-reset

Lancio una query di controllo che deve restituire:
- Titoli messi a cassa in aprile 2026: **0**
- Provvigioni generate per quei 2 titoli: **0**
- Stato dei 2 titoli: `attivo` con `data_messa_cassa=null`

Sulla dashboard vedrai:
- Card "Incassi del Mese" → **0** (€0)
- Card "Incassi Ieri" → **0**
- Raccolta Premi Anno → **€0**
- I 2 titoli torneranno visibili nel "Carico del Mese" pronti per essere ri-messi a cassa nei test

## File / azioni

- **Nessuna modifica al codice**
- **1 sola operazione DB** (DELETE provvigioni + UPDATE titoli, in transazione) sui 2 ID identificati sopra
- **1 inserimento** in `log_attivita` per ognuno dei 2 titoli (audit trail)

