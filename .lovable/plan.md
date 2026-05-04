# Pulizia database Clienti

## Clienti da TENERE (12)

| # | Cliente | P.IVA | Polizze |
|---|---|---|---:|
| 1 | COMUNE DI AFRAGOLA | 80047540630 | 19 |
| 2 | REGIONE CAMPANIA | — | 5 |
| 3 | Comune di Santa Marina Salina | — | 4 |
| 4 | RENT AND EVENTS SRL | 01890920703 | 39 |
| 5 | Lo Giudice Emilia Concetta | (privato) | 3 |
| 6 | COMUNE DI POMIGLIANO D'ARCO | 00307600635 | 33 |
| 7 | **CONSULBROKERS Società per Azioni** | 14003610962 | **58** |
| 8 | **CONSULBROKERS SPA** | 00970250767 | 2 |
| 9 | CANTIERE NAVALE BASILIO POSTIGLIONE SRL | 03539100630 | 32 |
| 10 | RSM SOC. DI REV. E ORGANIZ. CONT. | 01889000509 | 2 |
| 11 | ASSOCIAZIONE ASIS CB AIUTO IMMEDIATO | — | 1 |
| 12 | BRIGUORI CARLO | (privato) | 14 |
| | **TOTALE** | | **212** |

Le 3 polizze legacy intoccabili (204366651, 6131402092, RCM00010074404) restano: collegate a clienti keeper.

## Cosa verrà ELIMINATO

- **542 clienti** (su 554)
- **836 polizze** (su 1.048; restano 212)
- **8 sinistri**, **2 trattative**
- Record dipendenti dei titoli rimossi: appendici, movimenti contabili, provvigioni generate, eventi portafoglio, documenti, codici/nominativi cliente, privacy, chat contestuali, log attività.

## Da eliminare esplicitamente (Consulbrokers extra)

- CONSULBROKERS DIGITAL SRL A SOCIO UNICO (P.IVA 01209750379, 2 polizze)
- PROVVIGIONI EXTRA CONSULBROKERS S.p.A. (P.IVA duplicata 14003610962, 1 polizza)
- RSM ITALY CORPORATE FINANCE SRL (P.IVA 08025370969)

## Piano tecnico

1. Bypass trigger admin (`app.bypass_premi_lock=on`, `app.bypass_messa_cassa_lock=on`) nella stessa transazione.
2. Cancellazione FK-safe in singola transazione:
   - `provvigioni_generate`, `portafoglio_eventi`, `appendici`, `movimenti_contabili` legati ai titoli da rimuovere
   - `titoli` con `cliente_anagrafica_id NOT IN (keepers)` o NULL
   - `sinistri`, `trattative`, `documenti` (entita_tipo='cliente'), `codici_commerciali_cliente`, `nominativi_cliente`, `privacy_consensi`, `chat_canali` contestuali cliente, `clienti_relazioni`, `clienti_merge_log`
   - `clienti` non keeper
3. Verifica finale: count clienti / titoli / sinistri / trattative.

Operazione **distruttiva e irreversibile**. Conferma con "vai" per procedere.