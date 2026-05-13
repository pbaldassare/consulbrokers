# Automazione card "Periodo" in Immissione Polizza

## Obiettivo

In `ImmissionePolizzaPage`, calcolare automaticamente Durata Da/A, Garanzia Da/A e Data Competenza in base alla data odierna, agli **Anni Durata** e al nuovo campo **Frazionamento** (ex "Rate"). I valori restano sempre editabili manualmente, e la scansione AI (`parse-polizza-completa`) continua a sovrascrivere i default quando porta dati propri.

## Regole di calcolo

Sia `inizio` la data di Durata Da (default = oggi alla creazione).

- **Durata Da** = oggi (default alla prima apertura del form, se vuota).
- **Durata A** = `Durata Da + Anni Durata anni`.
- **Garanzia Da** = `Durata Da`.
- **Garanzia A** = `Garanzia Da + N mesi`, con N dipendente dal frazionamento:
  - Mensile → 1
  - Trimestrale → 3
  - Quadrimestrale → 4
  - Semestrale → 6
  - Annuale → 12
  - Poliennale → `Anni Durata × 12` (coincide con Durata A)
- **Data Competenza** = `Durata Da` (inizio contratto).

Ricalcolo automatico ad ogni cambio di Durata Da, Anni Durata o Frazionamento — purché l'utente non abbia modificato manualmente quel campo dopo l'auto-fill (vedi sotto).

## Editabilità manuale (override)

Per ogni campo derivato (Durata A, Garanzia Da, Garanzia A, Data Competenza) teniamo un flag `*Touched`. Se l'utente edita il campo, il flag diventa `true` e l'auto-ricalcolo non lo sovrascrive più. Il reset del form azzera i flag. La scansione AI imposta i campi e azzera i flag (i valori AI restano).

## Frazionamento — UI e DB

- Rinominare il campo "Rate" in **"Frazionamento"** e trasformarlo da `<Input number>` a `<SearchableSelect>` con opzioni: Mensile, Trimestrale, Quadrimestrale, Semestrale, Annuale, Poliennale. Default: **Annuale**.
- Mappa AI esistente (mensile/trimestrale/semestrale/annuale → numero rate) viene rimpiazzata: l'AI imposta direttamente il valore testuale.
- DB: aggiungere colonna `titoli.frazionamento text` (vincolata a quei 6 valori via CHECK). Manteniamo `titoli.rate integer` per retrocompatibilità, popolata in scrittura come 12/N (Poliennale → 1) per non rompere lookup esistenti che leggono `rate`.

## File toccati

- `src/pages/ImmissionePolizzaPage.tsx` — stato Frazionamento testuale, useEffect di auto-calcolo, flag touched, sostituzione input "Rate" con select, default `durataDa = today` all'avvio, salvataggio `frazionamento` in `insert(titoli)`.
- Migration Supabase: `ALTER TABLE titoli ADD COLUMN frazionamento text` + CHECK constraint sui 6 valori.

## Fuori scope

- `TitoloDetail` (modifica polizza esistente): non toccato in questo step.
- Logica di generazione rate/quietanze a partire dal frazionamento: non toccata.
