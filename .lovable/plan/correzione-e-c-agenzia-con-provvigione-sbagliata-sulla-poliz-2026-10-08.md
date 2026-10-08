# Correzione E/C Agenzia con provvigione sbagliata sulla polizza madre

## Cosa è stato trovato
Su 10 polizze madri finite negli E/C Agenzia archiviati è stata stampata la provvigione della rata successiva al posto di quella scritta sulla polizza. Nessuna di queste polizze è già in una rimessa pagata.

| Polizza | Premio | E/C attuale | Valore giusto (scritto) | E/C coinvolti |
|---|---:|---:|---:|---|
| 184683970 (Carozza) | 0,00 | 23,57 | 0,00 | B0879/261006 |
| 158157084 | 149,50 | 50,86 | 8,48 | B0879/261001, 261002, 261006 |
| 185157083 | 149,50 | 50,86 | 6,60 | B0879/261001, 261002, 261006 |
| 732611588 | 600,00 | 88,34 | 83,84 | B0879/261001, 261002, 261006 |
| 2026306571029 | 115,00 | 37,22 | 13,17 | B0616/261001, 261002 |
| 2026306572081 | 125,00 | 50,96 | 14,32 | B0616/261001, 261002 |
| 403216172 | 243,00 | 2,08 | 31,31 | B0480/261001, 261002 |
| IA0059 | 154,43 | 3,18 | 14,68 | B0021/261001, 261002 |
| ifle008136 | 59.000,00 | 2.895,71 | 1.737,42 | AIGASS/261001, 261002 |
| M17027891 | 3.890,00 | 954,48 | 477,30 | B0603/261001, 261002 |

In tutto 13 E/C archiviati da rigenerare (6 agenzie).

## Cosa faremo
1. **Rigenerazione con stesso numero**: per ognuno dei 13 E/C ricreo il PDF mantenendo numero di riferimento, data documento, periodo e le stesse righe (stesse polizze), ricalcolando solo provvigioni, totale provvigioni e ritenuta d'acconto con la regola corretta (vince il valore scritto, zero compreso).
2. **Sostituzione nell'archivio**: il nuovo PDF prende il posto di quello vecchio nello Storico E/C Agenzia (stesso documento, file sostituito), e le righe di ricerca vengono aggiornate con i nuovi importi.
3. **Traccia**: per ogni E/C rigenerato viene scritta una riga nel Log Attività con importi prima/dopo, così resta visibile cosa è cambiato.
4. **Pulsante riutilizzabile**: nello Storico E/C Agenzia (solo admin) un pulsante "Rigenera" sulla singola riga, per poter rifare la stessa operazione in futuro senza intervento tecnico.
5. **Esecuzione**: lancio la rigenerazione dei 13 E/C e verifico che totali e PDF corrispondano alla tabella sopra.

## Da sapere
- Intestazione (sede mittente, IBAN, indirizzo agenzia) verrà ripresa dai dati attuali dell'anagrafica: se nel frattempo sono cambiati, il PDF rigenerato li mostrerà aggiornati.
- Gli E/C già inviati via email alle agenzie non vengono reinviati automaticamente.

## Dettagli tecnici
- Nuovo modulo `src/lib/contabilita/rigeneraEcAgenzia.ts`: dato un record `ec_agenzia_archivio`, rilegge i titoli della compagnia con `stato='incassato'` il cui `numero_titolo - riga` coincide con le righe archiviate; estrae la costruzione di `ECAgenziaData` da `ECAgenziaPdfPage.buildData` in una funzione pura condivisa (`buildEcAgenziaData`) usata sia dalla pagina sia dalla rigenerazione; sede mittente = ufficio più frequente dei titoli (stessa logica attuale).
- Upload su `documenti_generali` allo stesso `path_storage` con `upsert: true`; update di `ec_agenzia_archivio.righe` e `testo_ricerca`; nessun nuovo progressivo allocato (`ec_progressivi` invariato).
- Se una riga archiviata non trova il titolo corrispondente, l'E/C non viene sovrascritto e viene segnalato.
- Pulsante in `ECAgenzieStoricoPage` visibile solo con `isAdmin`; log con `logAttivita({ azione: "rigenera_ec_agenzia", ... })`.
- Le storage policy del bucket non vengono modificate; se l'upsert non è consentito, si carica un nuovo file e si aggiorna `documenti.path_storage`.
