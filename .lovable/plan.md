## Obiettivo
Spostare i campi tecnici/flag attualmente in fondo alla sezione **Importi** dentro la sezione **Periodo**, per alleggerire la card Importi (che già contiene Premi, Provvigioni e composizione RCA) e raggruppare nella sezione Periodo tutti gli attributi "anagrafici" della polizza.

## Campi da spostare
Da **Importi** → **Periodo**:
- Valuta
- Indicizzata
- Rimborso
- Pag. Diretto Comp.
- Formato Elettronico
- Incassato (importo)
- Data Incasso

## Modifiche (solo UI, file `src/pages/TitoloDetail.tsx`)

### 1. Sezione Periodo (view mode, righe ~1889-1903)
Estendere la griglia esistente `grid-cols-2 md:grid-cols-4` aggiungendo i 7 nuovi `FieldRow` dopo `Disdetta (mesi)`:
- Valuta · Indicizzata · Rimborso · Pag. Diretto Comp.
- Formato Elettronico · Incassato · Data Incasso

Mantengono lo stesso stile `FieldRow` (allineamento, font, spaziatura) già usato nelle altre righe — nessun cambio grafico, solo riposizionamento.

### 2. Sezione Periodo (edit mode, righe ~1904+)
Aggiungere in fondo al form di edit Periodo un blocco "Valuta & Flag" con:
- `SearchableSelect` Valuta
- `Switch` Indicizzata
- `Switch` Rimborso

Spostando esattamente il blocco già presente alle righe 2453-2473 di Importi (stessa logica `importiForm` → da rinominare/spostare in `periodoForm` oppure mantenere `importiForm` ma renderizzarlo nel form Periodo). Per minimizzare rischi backend, **mantengo lo stato `importiForm` invariato** e sposto solo il JSX: il salvataggio Valuta/Flag continua a passare per `saveImportiMutation` (richiamata anche dal pulsante Salva di Periodo se attivo, oppure si lascia editabile solo in Importi e nella Periodo si mostrano sempre read-only).

**Decisione consigliata**: campi mostrati read-only in Periodo, edit rimane in Importi. Questo evita di toccare le mutation e mantiene le logiche backend intatte.

### 3. Sezione Importi
Rimuovere il blocco righe 2327-2335 (la griglia Valuta/Indicizzata/…/Data Incasso in view mode).
Lasciare invariato il blocco edit (righe 2452-2477) — l'utente continuerà a modificare Valuta/Indicizzata/Rimborso da Importi → Modifica.

## Risultato visivo
- **Periodo**: griglia compatta con tutte le date + i 7 nuovi campi (3 righe da 4 colonne su desktop).
- **Importi**: solo Premi / Provvigioni / Composizione RCA, più snella.

## Vincoli rispettati
- Nessuna modifica a database, query, mutation o tipi.
- Stile identico (FieldRow, fmt, fmtBool, fmtEuro, fmtDate già esistenti).
- Responsive invariato (grid-cols-2 md:grid-cols-4).