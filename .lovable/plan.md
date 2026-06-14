## Obiettivo

Gestire il caso in cui un unico bonifico (es. **Paolo Baldassarre 3.000 €**) paga polizze di **clienti diversi**. Oggi il ricongiungimento è vincolato al `cliente_id` pre-matchato in Excel; va sbloccato così l'utente può collegare polizze di qualsiasi cliente, e ogni polizza ricorda che è stata **"Pagata da" Baldassarre**.

Lo schema DB supporta già il caso: `movimenti_clienti` non ha unique su `movimento_id`, quindi posso creare **N righe** (una per cliente coinvolto) sotto lo stesso movimento bancario.

## Cosa cambia per l'utente (UX)

Nella pagina **Ricongiungimento Bancario → card movimento espansa**:

1. **Sezione "Cliente pre-matchato"** resta in alto (cliente identificato dall'Excel via Ordinante).
2. Nuova sezione **"Polizze collegate (multi-cliente)"** con:
   - elenco delle polizze già aggiunte (raggruppate per cliente), con importo modificabile e pulsante "rimuovi";
   - bottone **"+ Aggiungi polizza di altro cliente"** → apre un dialog con:
     - `SearchableSelect` cliente (cerca per ragione sociale / cognome / CF / P.IVA);
     - lista delle polizze attive non incassate di quel cliente (checkbox + importo suggerito = premio_lordo);
     - conferma → le righe vengono aggiunte alla selezione corrente.
3. Banner di quadratura aggiornato: `Σ polizze (tutti i clienti) + anticipo + ammanco = Importo movimento ±0,01`.
4. **"Pagato da"**: in fondo alla card, label informativa "Pagatore: {Ordinante del movimento}" che viene salvata su ogni riga polizza.

Anticipi/Ammanchi e i bottoni **Salva ricongiungimento / Metti a cassa / Garantito** restano invariati, ma operano sull'insieme multi-cliente.

## Modifiche tecniche

### DB (migrazione)
- `movimenti_polizze`: aggiungere colonne
  - `cliente_id uuid NULL REFERENCES clienti(id)` — il cliente proprietario della polizza in quella riga (denormalizzato per query veloci);
  - `pagato_da text NULL` — snapshot del nome ordinante (es. "BALDASSARRE PAOLO").
- Nessun cambio a `movimenti_clienti` (sfruttiamo la 1:N già esistente).
- Backfill: per le righe esistenti, `cliente_id` = `movimenti_clienti.cliente_id` del parent; `pagato_da` = `movimenti_bancari.ordinante`.

### Frontend (`RicongiungimentoBancarioPage.tsx`)
- Lo stato `selPol` diventa una mappa `{ titoloId → { clienteId, importo, numeroTitolo, ragioneSociale } }`.
- La query `polizze-cliente` viene mantenuta per il cliente pre-matchato + aggiunta una query on-demand per i clienti extra.
- Nuovo componente `AggiungiPolizzaAltroClienteDialog` (SearchableSelect cliente + lista polizze).
- `salvaRicongiungimento` ora:
  - raggruppa `selPol` per cliente;
  - upsert **una riga `movimenti_clienti` per cliente** sotto lo stesso `movimento_id` (delete + reinsert per semplicità);
  - inserisce le righe `movimenti_polizze` con `cliente_id` e `pagato_da = movimento.ordinante`.
- `MessaCassaDialog` riceve tutti i titoli selezionati (multi-cliente) — il dialog già lavora per `titoli.id`, niente da cambiare.
- Vista: nella card "Storico" e nelle viste E/C Cliente, mostrare il badge **"Pagato da {pagatore}"** quando `pagato_da != cliente intestatario`.

### Niente da toccare
- Excel import (`CaricamentoMovBancariPage`): resta com'è, il `cliente_id` pre-matchato è solo un suggerimento iniziale.
- RLS, trigger di messa a cassa, auto-quietanza: invariati.

## Verifica

1. Caricare un movimento da 3.000 € intestato a Baldassarre.
2. Espandere la card → aggiungere 1 polizza di Baldassarre (1.200 €) + 1 polizza di Cliente X (900 €) + 1 polizza di Cliente Y (900 €).
3. Banner deve mostrare quadratura ±0,01.
4. Salva → in DB devono esserci 3 righe `movimenti_clienti` (3 clienti diversi) e 3 righe `movimenti_polizze` con `pagato_da = "BALDASSARRE PAOLO"`.
5. "Metti a cassa" deve incassare tutte e 3 le polizze in un colpo solo; stato movimento → `incassato`.
6. Aprire E/C di Cliente X → la polizza incassata mostra badge "Pagato da BALDASSARRE PAOLO".
