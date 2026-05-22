# Sospensione Polizza — Nuova Specifica

Allineamento del comportamento dell'operazione **Sospensione** alle regole confermate dall'utente. Niente DB schema changes: si lavora su default di form, mutation, filtri di lista e cleanup quietanze.

## 1. Form Sospensione (`SospensionePolizzaPage`)

- **`limite_riattivazione`**: default = `data_sospensione + 3 mesi` (precompilato, l'utente può modificarlo).
- **`motivo_sospensione`**: testo libero con placeholder/default suggerito (es. "Sospensione su richiesta cliente"); il campo resta editabile.
- Resto del form invariato.

## 2. Scrittura sul titolo (rata su cui si apre l'operazione)

Su `titoli` (solo la rata selezionata):
- `stato = 'sospeso'`
- `data_sospensione = <data scelta>`
- `limite_riattivazione = <data scelta o default +3 mesi>`
- `motivo_sospensione = <testo>`

## 3. UI TitoloDetail — eccezione al lock

Oggi `isLocked` in `TitoloDetail.tsx` blocca i Modifica anche quando `stato === 'sospeso'` (via memoria *titolo-detail-allineato-immissione* — in realtà oggi locka solo `data_messa_cassa || incassato || stornato`; va verificato che `sospeso` resti editabile).

Regola: **quando `stato = 'sospeso'` la polizza resta modificabile** (campi contratto/firma/quietanza/importi). Solo Messa a Cassa / Storno / Annullamento restano disabilitate sulla rata sospesa; Riattivazione si abilita. Banner informativo "Polizza sospesa fino al …" sopra le sezioni, senza disabilitare gli input.

## 4. Visibilità nelle liste di Portafoglio

- **Polizze Attive**: la rata sospesa **resta visibile** (oggi il filtro è `stato = 'attivo'`; va esteso per includere `sospeso`, con badge "Sospesa").
- **Carico del Mese**: la rata sospesa **non** appare (resta com'è oggi).
- **Storico Polizze**: la rata sospesa **non** vi compare (oggi sì — va escluso `sospeso` dal filtro storico).

## 5. Quietanze successive — rimozione

Cambio importante rispetto al comportamento attuale (che lasciava intatte le quietanze figlie):

- Alla conferma della Sospensione, **tutte le quietanze successive** della stessa catena polizza (stessi `numero_titolo` collegati via `sostituisce_polizza`, con `riga > rata sospesa`) e che **non sono ancora state messe a cassa / incassate** vengono **eliminate** dal DB.
- Le quietanze già `incassato` / con `data_messa_cassa` valorizzata restano (regola: la sospensione è prospettica, non retroattiva — gli incassi storici non si toccano).
- Razionale: le rate future verranno ricalcolate al momento della Riattivazione (date e importi) e non hanno più senso finché la polizza è sospesa.
- Aggiornare `assertSameTitolo` non serve: il delete è scoped per `numero_titolo` + `riga > current` + `stato != 'incassato'` + `data_messa_cassa IS NULL`.

## 6. Contabilità (invariato — già corretto)

Nessun movimento di cassa, nessuna distinta, nessun E/C toccato. Messa a Cassa bloccata, provvigioni non maturano sulla rata sospesa, rimesse già chiuse non impattate.

## 7. `movimenti_polizza` (invariato — già corretto)

Inserimento riga con `tipo_documento='SO'`, `data_movimento=data_sospensione`, `descrizione="Sospensione polizza"` + motivo, `stato='sospeso'`.

## 8. Audit (invariato)

`logAttivita('sospensione_polizza', 'titolo', id, { data_sospensione, limite_riattivazione, motivo, quietanze_eliminate: [...] })` + diff trigger DB.

## 9. Cosa non fa (invariato)

No comunicazione compagnia, no PDF, no impatto sinistri, no disattivazione cliente.

---

## File coinvolti (frontend-only, niente migrations)

- `src/pages/SospensionePolizzaPage.tsx` — default `limite_riattivazione = +3 mesi`, default motivo, mutation: delete quietanze figlie non incassate, insert movimento `SO`, log.
- `src/pages/TitoloDetail.tsx` — verificare che `stato='sospeso'` NON entri in `isLocked`; aggiungere banner sospensione informativo (non bloccante).
- `src/pages/PortafoglioAttivePage.tsx` — estendere filtro per includere `sospeso` + badge.
- `src/pages/PortafoglioStoricoPage.tsx` — escludere `sospeso` dal filtro.
- `src/pages/PortafoglioCaricoPage.tsx` — confermare che `sospeso` resta fuori (probabile, da verificare).

## Verifica

1. Apertura SospensionePolizzaPage: `limite_riattivazione` precompilato a +3m, motivo con default.
2. Conferma: rata → `sospeso`; quietanze figlie non incassate **cancellate**; quietanze già incassate intatte.
3. Lista Polizze Attive: rata sospesa visibile con badge.
4. Lista Storico: rata sospesa NON visibile.
5. TitoloDetail: campi editabili, banner sospensione, Riattivazione abilitata, Messa a Cassa/Storno disabilitati.
6. `movimenti_polizza` ha la riga `SO`, `log_attivita` ha l'evento con elenco quietanze eliminate.

## Aperti per la prossima iterazione

- **Riattivazione**: ricalcolo automatico delle quietanze (date + importi) dalla rata riattivata fino a scadenza, in base al frazionamento. Da definire dopo, come specifica separata.
