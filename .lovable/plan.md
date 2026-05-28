## Obiettivo
Negli Estratti Conto Clienti devono comparire **solo i titoli (polizze e quietanze) effettivamente messi a cassa** — non l'intero portafoglio. Anche KPI/totali devono essere calcolati solo su questi.

## Stato attuale
- `ECClientiContabPage.tsx` legge tutti i `titoli` del cliente (nessun filtro su `data_messa_cassa`); i filtri "Competenza" usano impropriamente `data_incasso` / `created_at`. Risultato: Totale Dare 63.013 € con Totale Avere 0 € (mostra anche polizze non incassate).
- `ECClientePdfPage.tsx` (PDF E/C cliente) seleziona i titoli filtrando per `garanzia_da`, senza richiedere messa a cassa.
- Le pagine E/C Agenzie / Produttori / Compagnia già filtrano correttamente su `data_messa_cassa` (nessuna modifica).
- `ECClientiStoricoPage.tsx` legge solo PDF archiviati: non tocco.

## Modifiche

### 1. `src/pages/contabilita/ECClientiContabPage.tsx`
- Aggiungere `.not("data_messa_cassa", "is", null)` alla query `titoli` così entrano solo le quietanze/polizze messe a cassa.
- Cambiare i filtri "Competenza dal/al" perché agiscano su `data_messa_cassa` (oggi `data_incasso`).
- Rimuovere il filtro "Scadenza dal/al" su `created_at` (non significativo per messa a cassa) o riallinearlo a `data_decorrenza_rinnovo` — proposto: lasciarlo agganciato a `garanzia_da` come "Scadenza copertura".
- KPI, totali e righe restano calcolati sul set filtrato (di fatto già lo fanno → automaticamente conformi).

### 2. `src/pages/contabilita/ECClientePdfPage.tsx`
- Nella query titoli aggiungere `.not("data_messa_cassa", "is", null)`.
- Quando `periodoDal/periodoAl` arrivano via querystring, filtrare su `data_messa_cassa` invece che `garanzia_da` (allineamento con la pagina elenco).
- Ordinamento per `data_messa_cassa asc`.

### 3. Memoria
- Aggiornare `mem://accounting/financial-statements-module` (o creare nota `ec-clienti-messa-a-cassa`) annotando che gli E/C Clienti includono solo titoli con `data_messa_cassa` valorizzata, coerentemente con E/C Agenzie/Produttori.

## Non incluso
- Nessun cambio a schema DB, RLS, edge functions.
- Nessuna modifica a Storico E/C, E/C Agenzie, E/C Produttori, E/C Compagnia (già corretti).

## Verifica
- Aprire `/contabilita/ec-clienti`: KPI Totale Dare deve scendere a somma dei soli titoli messi a cassa; Totale Avere deve coincidere con gli incassi effettivi (saldo ≈ 0 sui clienti con tutto in cassa).
- Generare PDF E/C cliente: elenco e totale riflettono solo le rate in cassa nel periodo.
