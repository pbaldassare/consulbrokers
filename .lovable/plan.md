## Obiettivo

Finché una polizza **non è messa a cassa** (`data_messa_cassa IS NULL` e `stato ≠ 'incassato'`), la pagina dettaglio titolo deve comportarsi come la **continuazione della creazione**: stessi componenti, stesso layout, stessa logica di validazione di `ImmissionePolizzaPage`. Eliminare le card legacy con campi liberi (voce libera, sottoramo nel form, doppio editor importi).

Quando la polizza è messa a cassa → tutto torna read-only (come oggi).

## Cambiamenti

### 1. Sostituire `SectionCollapsible` con `PolizzaSection`
File: `src/pages/TitoloDetail.tsx`. Le sezioni Cliente & Sede, Tipo Polizza, Contratto, Periodo, Regolazione, Importi, Provvigioni Commerciale, Dati Veicolo, Dati Conducente usano lo stesso wrapper `PolizzaSection` (icona + titolo + collapsible) di immissione. Look identico.

### 2. Sezione **Contratto** — riusare il blocco di immissione
- Rimuovere il selettore `RamoSottoramoSelect` "ramo + sottoramo" → in modifica resta **solo Ramo** (gruppo) come in immissione (`gruppoOnly`). Il sottoramo si sceglie riga per riga nelle card Premio (memoria `sottoramo-as-garanzia-row`).
- Cambio Ramo → reset righe garanzia (stesso comportamento immissione).
- Stessi campi editabili: Prodotto (testo libero), Specialist, Produttore, Sede, CIG, Vincolo, Descrizione + rapporto agenzia se plurimo.

### 3. Sezione **Periodo** — uniformare
- Stessa griglia di immissione: Durata Da/A, Anni Durata, Frazionamento (testo, da `FRAZIONAMENTI`), Garanzia Da/A, Data Competenza/Scadenza, Limite Mora, GG Mora, Tacito Rinnovo (boolean), Disdetta mesi, Valuta, Indicizzata, Rimborso, Pag. Diretto Comp., Formato Elettronico.
- Spostare Valuta/Indicizzata/Rimborso fuori da "Importi" (oggi sono in Importi-edit) e tenerle qui come in immissione. Eliminare il blocco "Valuta + flag" duplicato dalla sezione Importi.

### 4. Sezione **Importi** — adottare `PremiGaranziaCardShell`
- **Rimuovere** `VociRcaCard` (Firma + Quietanza) dalla sezione Importi del dettaglio.
- **Sostituire** con due `PremiGaranziaCardShell` (Firma + Quietanza), gli stessi di immissione, con:
  - colonna "Voce" = `SearchableSelect` di **sottorami** (`rami` filtrati per `gruppo_ramo_id` selezionato in Contratto). **Niente più voce libera.**
  - mirroring Firma → Quietanza con flag `quietanza_personalizzata` (memoria `rca-voci-composizione-premio`).
  - per rami auto/natanti: prima riga è `RC Auto/Natanti/Corpi` non rimovibile + calcolo IPT/SSN.
  - persistenza: scrivere/aggiornare/cancellare righe in `premi_garanzia_polizza` direttamente (debounced) come fa immissione al submit. Totali (`titoli.premio_netto/tasse/premio_lordo` e `_quietanza`) ricalcolati dal trigger DB esistente (o da `onTotaliChange`).
- Eliminare lo stato `editingImporti`, `importiForm`, `saveImportiMutation` e tutti i campi/somme inline duplicati.
- Resta visibile (read-only) il riepilogo Netto/Tasse/Lordo Firma/Quietanza + provvigioni + split.
- Pulsante **Importa con AI** (`ImportPolizzaAiButton`) come in immissione, accanto alle card.

### 5. Sezione **Provvigioni — Commerciale**
Allineare al layout di immissione (`PolizzaSection title="Provvigioni — Commerciale"`), stessi campi e split.

### 6. Dati Veicolo / Conducente (rami auto)
Riusare gli stessi componenti di immissione (`PolizzaSection` + form fields) condizionati a `isRamoAuto`.

### 7. Lock messa-a-cassa
Definire `const isLocked = !!t.data_messa_cassa || t.stato === "incassato" || t.stato === "stornato"`.
- Nascondere tutti i pulsanti "Modifica" delle sezioni quando `isLocked`.
- `PremiGaranziaCardShell` riceve prop `readOnly={isLocked}` (verificare che il componente supporti già il flag; in caso aggiungerlo).
- Mostrare un banner sopra la pagina: *"Polizza messa a cassa — modifiche bloccate. Per riaprirla usa Annulla Messa a Cassa."*

### 8. Sezioni che restano invariate
Header titolo, badge stato, pulsanti operazioni (Messa a Cassa, Sospensione, Riattivazione, Rinnovo, Storno, Appendici), tab Movimenti, tab Documenti, tab Chat, tab Log Attività, tab Sinistri.

## File toccati

- `src/pages/TitoloDetail.tsx` — refactor principale (sostituzione wrapper + sezioni Contratto/Periodo/Importi/Provvigioni).
- `src/components/polizze/PremiGaranziaCardShell.tsx` — verificare/aggiungere prop `readOnly` e prop di persistenza diretta (`titoloId` per scrivere su `premi_garanzia_polizza` invece che gestire solo state in-memory).
- `src/components/titolo/TitoloTabs.tsx` — nessuna modifica funzionale (solo eventuale pulizia visiva).
- `mem://insurance/titolo-detail-allineato-immissione` — nuova memoria che documenta l'allineamento e il lock messa-a-cassa.
- `mem://insurance/rca-voci-composizione-premio` — aggiornare nota: in TitoloDetail si usa ora `PremiGaranziaCardShell` (non più `VociRcaCard`).

## Non in scope

- Cambi DB / migration.
- Logica operazioni polizza (rinnovo, storno, sospensione, messa a cassa) — restano com'è.
- Tab non legate al corpo polizza.
