---
name: Messa a cassa — flusso completo
description: Cosa succede, file per file e trigger per trigger, quando si conferma una messa a cassa (ricostruito dal grafo graphify del 07/10/2026)
type: feature
---

# Messa a cassa — dal click all'ultima conseguenza

Punto di ingresso unico: `src/components/portafoglio/MessaCassaDialog.tsx` → `handleConferma()`.
Si apre da TitoloDetail, ClienteDetail, IncassiPage, GestionePolizzePage, RicongiungimentoBancarioPage
(e AzioniPolizzaToolbar). Ogni modifica qui vale per tutte e cinque le pagine.

## 1. Controlli prima di scrivere (frontend)

In ordine, ognuno blocca con un messaggio:
1. data messa a cassa obbligatoria (`messaCassaDate.ts`);
2. quadratura: dovuto = incasso + acconti + abbuoni/arrotondamenti (`compensazioniMessaCassa.ts`);
3. tipo pagamento obbligatorio (`incassoTipoPagamento.ts`);
4. eccedenza/mancanza sul bonifico va classificata (ACC_*, ABB_*, ARROT_*), mai in automatico;
5. bonifico → conto Consulbrokers obbligatorio (`filterContiBancariPerSede.ts`);
6. CIG definitivo valido per gli enti (`cigEnte.ts`, `validateCig.ts`);
7. bonifico da collegare se ci sono candidati sul conto (`bonificoMatch.ts`);
8. **sequenza**: non si incassa una rata se la precedente è aperta (`messaCassaSequenza.ts`, `messaCassaSequenzaDb.ts`);
9. titolo o polizza madre **sospesi** → stop (`quietanze.ts`, `sospensioneQuietanze.ts`).

## 2. Scrittura sul titolo (per ogni titolo selezionato)

`UPDATE titoli`: `importo_incassato` (precedente + cassa + acconti usati), `tipo_pagamento`, `banca_pagamento`.
Se l'incasso copre il dovuto: `stato='incassato'`, `data_messa_cassa`, `data_pagamento`, `data_incasso`,
`data_copertura`, `data_decorrenza_rinnovo` (`garantitoTitolo.ts` → `buildIncassoDateFields`).
Pagamento diretto in compagnia: `importo_incassato=0`, `pag_diretto_compagnia=true`.

## 3. Trigger database che scattano su quell'UPDATE

Prima della scrittura (possono bloccarla):
- `trg_blocca_incasso_fuori_sequenza` — stessa regola della sequenza, lato DB;
- `trg_prevent_double_messa_cassa` — vieta di reincassare un titolo già a cassa (eccezione: poliennali);
- `trg_lock_premi_storici` — vieta di cambiare i premi di un periodo chiuso e incassato.

Dopo la scrittura:
- `trg_genera_quietanza_su_messa_cassa` — **crea la quietanza successiva** (rata dopo `garanzia_a`,
  durata dal frazionamento). Non per rata unica / temporanea; idempotente.
- `trg_attiva_rinnovo_su_messa_cassa` — riattiva le figlie `in_attesa_rinnovo`.
- `trg_estendi_polizza_incasso_proroga` — se è una proroga, allunga la scadenza della polizza madre.
- `trg_titoli_sync_quietanza_da_titolo` — allinea la tabella parallela `quietanze`.
- `trg_audit_titoli` — audit trail.

## 4. Movimenti collegati (frontend, dopo l'UPDATE)

- titolo a credito (premio negativo) → acconto cliente (`anticipoDaTitoloCredito.ts`);
- uso acconti → `cliente_anticipi_utilizzi` + `movimenti_contabili`;
- giroconti → `giroconti_cliente`; compensazioni → `titoli_compensazioni` + `movimenti_contabili`;
- modalità incasso → `titoli_modalita_incasso` (`modalitaIncasso.ts`);
- `log_attivita` (`logAttivita.ts`).

## 5. Provvigioni

Edge function `calcola-provvigioni`: cancella e rigenera `provvigioni_generate` per il titolo
(produttori da `titoli_split_commerciali`, AE, residuo Consulbrokers). Se il produttore trattiene
la provvigione all'incasso (`trattenutaProvvigioniIncasso.ts`), la riga è segnata pagata.
Errore qui = solo avviso: l'incasso resta valido ma le provvigioni vanno ricalcolate.

## 6. Dopo il ciclo

- CIG condiviso → aggiornato anche sulla polizza madre;
- acconti ACC_* classificati a mano → `cliente_anticipi` sul cliente pagatore;
- **avviso agenzia** (`notificaMessaCassa.ts`): subito, oppure in coda serale se spuntato
  (`messa_cassa_notifiche_coda`); edge `notifica-messa-cassa-agenzia` manda l'email, archivia il PDF
  in `documenti` (tab Documenti del cliente) e scrive `log_attivita`;
- **bonifici**: `bonificoDaIncasso.ts` → `ricongiungiEFinalizzaBonificiMultipliDaIncasso` collega e chiude
  i movimenti bancari usati (`movimenti_polizze`).

## Riflessi a valle (letture, nessuna scrittura)

E/C agenzia (solo `data_messa_cassa ≥ 01/09/2026`), Riepilogo messe a cassa, Prima nota, Comunicazioni
di incasso, Carico del mese (il titolo sparisce dai pendenti, compare la quietanza successiva).

## Punti fragili

1. **Transazione unica (dal 07/10/2026)**: passi 2 e 4, più CIG madre e acconti ACC_*, sono una sola
   RPC `conferma_messa_cassa` (migrazione `20261007120000_conferma_messa_cassa_transazione.sql`,
   SECURITY INVOKER): se un passo o un trigger fallisce non resta salvato nulla, anche con più titoli.
   Restano fuori, dopo il commit: provvigioni (edge, ricalcolabile), email agenzia, collegamento bonifici.
2. **Regole duplicate frontend/DB**: sequenza e doppio incasso sono controllati in entrambi i posti;
   cambiarne uno solo crea comportamenti incoerenti.
3. **Quietanza successiva invisibile nel codice app**: la crea il trigger. Chi cerca "dove nasce la
   rata dopo" nel frontend non la trova.
4. **Un dialog, cinque pagine**: ogni modifica a `MessaCassaDialog` va provata da tutte le pagine che lo aprono.
5. **Provvigioni ricalcolate da zero** a ogni incasso: modifiche manuali su `provvigioni_generate`
   del titolo vengono sovrascritte.
