## Annullamento polizze/quietanze — CAMERA DI COMMERCIO DI SALERNO

Cliente: `5bf442ef-f109-4457-9c2c-127e986ca145` (CAMERA DI COMMERCIO DI SALERNO).

**Stato attuale rilevato:**
- 2 titoli (numero `4344334`): 1 polizza `attivo` + 1 quietanza `incassato` (messa a cassa del 24/06/2026)
- 1 polizza, 1 movimento polizza, 2 provvigioni generate
- 0 titoli protetti (i 3 numeri storici intoccabili non sono presenti)
- 0 rimesse dettaglio, 0 movimenti bancari del cliente

**Operazione**
Eseguo la RPC canonica `annulla_polizza_cascade` (file `src/lib/annullaPolizza.ts`) su **entrambi** i titoli. Per ciascuno la funzione:
- elimina in cascade `pagamenti_provvigioni_righe`, `provvigioni_generate`, `rimessa_dettaglio` (+ testate rimessa rimaste vuote), `movimenti_contabili`, `movimenti_polizza`, `titoli_split_commerciali`, quietanze discendenti
- annulla la messa a cassa (azzera `data_messa_cassa`, `data_incasso`, `importo_incassato`)
- lascia il titolo in stato `annullato` come ancora per il log audit

**Effetti collaterali attesi (positivi):**
- E/C agenzia Generali (`compagnia_id 1cf2cbb4…`) — la riga in pagamento legata a questa quietanza sparirà
- E/C cliente Camera Commercio Salerno — diventa pulito
- Provvigioni maturate del produttore INTERFIDI SRL — i 2 record rimossi

**Sicurezza**
- Migration SQL singola che esegue `SELECT public.annulla_polizza_cascade(id)` per i 2 UUID specifici dei titoli del cliente
- Guard preliminare: blocca se uno dei titoli ha `numero_titolo IN ('204366651','6131402092','RCM00010074404')` (regola permanente)
- Operazione **irreversibile** — i titoli resteranno visibili come `annullato` ma tutte le provvigioni/rimesse/movimenti sono eliminati

**Cliente anagrafica:** non viene toccato (resta visibile in `/archivi/clienti`).

Confermi l'esecuzione?