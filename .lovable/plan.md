## Obiettivo

Quando una compagnia, a seguito di **Sostituzione** o **Sospensione/Riattivazione**, emette un nuovo numero di polizza, l'operatore deve poterlo inserire nei rispettivi dialog. La polizza resta la **stessa** (stesso record `titoli`, stesso `id`, stesse quietanze): cambia solo `numero_titolo` corrente, e il vecchio numero viene **archiviato** in una nuova tabella `titoli_numeri_storici`, visibile in dettaglio polizza.

In più, il dialog di **Sostituzione** deve mostrare i campi specifici per ramo (oggi mostra solo "Descrizione nuovo oggetto"): per RCA Auto va mostrato il blocco veicolo + conducente identico a quello di Immissione; per gli altri rami i campi tipici del ramo (vedi sotto).

## 1. Database

Nuova tabella `titoli_numeri_storici`:
- `titolo_id` → `titoli.id` (ON DELETE CASCADE)
- `numero_precedente` text (era `numero_titolo` prima del cambio)
- `numero_nuovo` text (quello impostato dopo)
- `cambiato_il` timestamp
- `cambiato_da_user_id` uuid
- `causale` text — enum applicativo: `sostituzione | sospensione | riattivazione`
- `motivo` text nullable
- `riferimento_id` uuid nullable (es. id `titoli_sostituzioni`)

GRANT + RLS: SELECT/INSERT authenticated, ALL service_role, DELETE solo admin/responsabile_sede.

Nessuna modifica a `titoli`: il "nuovo numero corrente" sovrascrive `numero_titolo` (idem si propaga su tutte le quietanze figlie tramite update `WHERE numero_titolo = vecchio`).

## 2. Sostituzione (`SostituzionePolizzaDialog`)

Aggiungo in cima al form, opzionale:
- **Nuovo numero polizza** (text, default = numero attuale). Validazione: se diverso dal corrente e non vuoto.
- Se cambiato → mutation aggiorna `titoli.numero_titolo` su tutte le righe con `numero_titolo = old` (madre + quietanze + conguaglio appena creato) e inserisce riga in `titoli_numeri_storici` con `causale='sostituzione'` e `riferimento_id = titoli_sostituzioni.id`.

Aggiungo blocco **"Nuovi parametri oggetto"** ramo-aware (reuse dei componenti già presenti in `ImmissionePolizzaPage`):
- **RCA Auto** (gruppo ramo RCA/AUTO o flag): sezione completa Veicolo (`MarcaModelloCombobox`, targa, telaio, alimentazione, potenza, cilindrata, anno immatricolazione, tipo veicolo→settore, uso `rca_usi`, classe BM, sinistri ultimi 5 anni) + Conducente (CF, nome, cognome, data nascita, comune nascita, patente, anno patente). Snapshot in `titoli_sostituzioni.parametri_precedenti/nuovi`; update `veicoli_polizza`.
- **Trasporti**: tratta, merce, valore.
- **Vita**: beneficiari (testo libero).
- **Altri rami**: textarea "Descrizione nuovo oggetto" (come oggi).
- Mapping ramo→sezione centralizzato in nuovo helper `src/lib/sostituzioneFieldsByRamo.ts` (ramo non riconosciuto → solo descrizione).

Validazione: per RCA almeno targa+marca+modello obbligatori.

## 3. Sospensione (`SospensionePolizzaDialog`) e Riattivazione (`RiattivazionePolizzaDialog`)

Aggiungo campo opzionale **"Nuovo numero polizza"** (default = corrente).
- In Sospensione: se inserito e diverso → update `numero_titolo` su tutte le righe della polizza + insert in `titoli_numeri_storici` con `causale='sospensione'`.
- In Riattivazione: idem con `causale='riattivazione'`.
- Quietanze cancellate dalle regole esistenti (default +10 mesi) restano invariate; la futura quietanza auto-generata erediterà il nuovo numero.

## 4. UI dettaglio polizza (`TitoloDetail`)

Nuova card/tab **"Numeri polizza storici"** (sotto "Operazioni"): tabella read-only con `numero_precedente → numero_nuovo`, data, utente, causale, motivo. Compare solo se ci sono record.

Header polizza mostra sempre `numero_titolo` corrente (già lo fa). Niente cambi al routing.

## 5. Memoria

Aggiorno `mem://insurance/policy-replacement-extinction-rules.md` e `mem://insurance/policy-suspension-rules.md` con le nuove regole, e creo `mem://insurance/policy-number-history.md`.

## Dettagli tecnici

- Tutte le mutation client-side in una sola transazione logica: prima upsert numeri_storici, poi update massivo `titoli SET numero_titolo = :new WHERE numero_titolo = :old`. Se l'aggiornamento fallisce per unicità (improbabile, non c'è UNIQUE), rollback applicativo con messaggio.
- `assertSameTitolo` non impattato (lavora su `id`, non su `numero_titolo`).
- `sostituisce_polizza` esistenti che referenziano il vecchio numero vengono aggiornati allo stesso modo (stesso `UPDATE ... WHERE sostituisce_polizza = old`).
- Per il blocco RCA condiviso introduco un componente riutilizzabile `RcaVeicoloConducenteForm` estratto da `ImmissionePolizzaPage`, usato sia in Immissione sia nel nuovo Sostituzione (refactor leggero, stesse props/stato controllato).

## File toccati

- migration: `titoli_numeri_storici` (CREATE + GRANT + RLS + 3 policy)
- `src/components/polizze/SostituzionePolizzaDialog.tsx` (campo numero, blocco ramo-aware, mutation)
- `src/components/polizze/SospensionePolizzaDialog.tsx` (campo numero + propagazione)
- `src/components/polizze/RiattivazionePolizzaDialog.tsx` (campo numero + propagazione)
- `src/components/polizze/RcaVeicoloConducenteForm.tsx` (nuovo, estratto)
- `src/pages/ImmissionePolizzaPage.tsx` (sostituisce blocco RCA con il nuovo componente)
- `src/pages/TitoloDetail.tsx` (card "Numeri polizza storici")
- `src/lib/sostituzioneFieldsByRamo.ts` (nuovo helper)
- `src/lib/aggiornaNumeroPolizza.ts` (nuovo helper transazionale)
- memorie

Conferma se ok, oppure dimmi se vuoi limitare il "form esteso" a soli RCA in prima iterazione e rinviare gli altri rami.