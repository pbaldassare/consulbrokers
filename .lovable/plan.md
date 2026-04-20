

## Analisi

L'utente ha modificato il premio sulla polizza originale (ora vediamo Premio Lordo €1907.72, Quietanza €1695.75) ma quando lancia il rinnovo dal dialog, il nuovo titolo viene creato con i **valori originali** della polizza, non con quelli **attuali** modificati.

## Causa probabile

In `RinnovoTitoloDialog.tsx` i campi premio (premio_netto, premio_lordo, tasse, addizionali, provvigioni, ecc.) sono probabilmente:
- letti una sola volta all'apertura del dialog (stato iniziale stale), oppure
- copiati da un oggetto `t` (titolo) che viene passato come prop ma non rifetchato dopo le modifiche, oppure
- presi dal "premio firma" originale invece che dal "premio quietanza" attuale

Devo controllare il file per capire esattamente da dove vengono pescati i valori al momento del submit.

## Cosa verificherò

1. `src/components/polizze/RinnovoTitoloDialog.tsx` → vedere quali campi premio vengono passati nell'insert del nuovo titolo e da dove arrivano (props `t` o form state)
2. Capire se il dialog riceve `t` come snapshot o se rifetcha dal DB all'apertura
3. Verificare quali sono i campi "firma" vs "quietanza" e quale logica di rinnovo è corretta

## Fix previsto

Due possibili approcci, sceglierò il giusto in base al codice:

**A) Rifetch all'apertura del dialog**: quando il dialog si apre, fare una `select` fresca del titolo dal DB così i valori sono sempre aggiornati.

**B) Usare i valori "quietanza" attuali**: nel rinnovo bisogna copiare i valori correnti (quelli modificati: premio netto quietanza, tasse quietanza, premio lordo, provvigioni) e non i valori firma originali.

Quasi certamente serve un **mix**: rifetch + uso dei campi quietanza correnti come base del nuovo titolo.

Inoltre i campi del form di rinnovo (input modificabili dall'utente prima di confermare) devono essere **pre-popolati con i valori attuali** così l'utente vede il premio corretto e può confermare/correggere.

## File toccato

- `src/components/polizze/RinnovoTitoloDialog.tsx` (1 file, ~10-20 righe)

## Cosa NON faccio

- Nessuna modifica DB / RLS / policy
- Nessuna modifica allo schema
- Nessun impatto su altri flussi (immissione, appendici, storno)

## Verifica post-fix

1. Modifico il premio di una polizza
2. Apro il dialog di rinnovo → vedo il premio aggiornato pre-compilato
3. Confermo → il nuovo titolo creato ha i valori aggiornati, non quelli originali

