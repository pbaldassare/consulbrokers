## Obiettivo

Nella pagina **Immissione Polizza** (`/portafoglio/immissione`), mostrare i campi specifici di ramo solo quando hanno senso:

- Il campo **Targa/Telaio** nel blocco "Contratto" deve apparire **solo se il ramo selezionato è RCA Auto** (`isRCA === true`). Per polizze non-auto (es. RC Generale, Vita, Infortuni…) sparisce, perché non serve.
- Le sezioni RCA esistenti (🚗 Dati Veicolo, 💰 Dati Premio per Garanzia, 👤 Dati Conducente) — che già appaiono condizionalmente — vanno **rese visivamente più riconoscibili** quando attive (header colorato, icona, separatore netto dal resto del form).
- Quando il ramo NON è auto, nessun campo "veicolo" deve essere visibile né salvato.

## Cambiamenti tecnici (file: `src/pages/ImmissionePolizzaPage.tsx`)

### 1. Targa/Telaio condizionale nel blocco Contratto
- Linee ~705–712: il `<div>` con label "Targa/Telaio" viene wrappato in `{isRCA && (...)}`.
- Quando il ramo cambia da auto a non-auto, resettare lo state `targaTelaio` a "" per evitare salvataggi sporchi (effetto in un `useEffect([isRCA])`).
- Adeguare il grid del blocco: con 4 colonne fisse, quando Targa/Telaio è nascosto la riga resta a 3 elementi — accettabile, oppure passare il grid a `grid-cols-2 md:grid-cols-3` quando `!isRCA` per evitare colonna vuota.

### 2. Migliore grafica delle sezioni RCA
Le tre fieldset RCA (linee 1064–1227) oggi hanno solo `border-l-4 border-l-primary`. Le rendiamo più distinte:

- Banner di intestazione RCA prima delle 3 fieldset, tipo:
  ```
  ┌─────────────────────────────────────────────┐
  │ 🚗 SEZIONE RCA AUTO — dati veicolo richiesti│
  └─────────────────────────────────────────────┘
  ```
  con sfondo `bg-primary/5`, testo `text-primary`, padding e bordo arrotondato.
- Le legend già hanno emoji 🚗 💰 👤 — uniformare lo sfondo a `bg-primary/15` e aggiungere icona `lucide-react` (`Car`, `Receipt`, `User`).
- Aggiungere una sottile separazione visiva (margin-top maggiore) tra il blocco "Tipo" e l'inizio delle sezioni RCA.

### 3. Pulizia stato (anti-bug salvataggio)
Aggiungere un `useEffect` che osserva `isRCA`:
- Se diventa `false`, azzera tutti gli `v*` e `c*` (vMarca, vModello, vTarga, vTelaio, vClasseBm, premiGaranzia, cNome, cCognome, …) e `targaTelaio`.
- Questo evita che, se l'utente prima sceglie "Auto", compila qualcosa, poi cambia ramo, i dati veicolo restino in memoria e vengano salvati comunque dalla `if (isRCA) { ... insert rca_dati ... }` (linea 467–473).

### 4. Hint UX
Sotto il dropdown "Ramo" (blocco Contratto), quando `isRCA === true` mostrare un piccolo testo informativo:
> "Ramo RCA rilevato: in fondo alla pagina troverai le sezioni dedicate a veicolo, garanzie e conducente."

## Cosa NON cambia

- Schema DB e logica di salvataggio in `rca_dati` restano identici.
- Le tre sezioni RCA esistenti restano dove sono (in fondo al form), continuano ad apparire solo se `isRCA`.
- Il rilevamento `isRCA` resta basato su `gruppo_ramo` + checkbox `polizzaAuto` (linea 350).
- Nessuna modifica a `RinnovoTitoloDialog.tsx`, `TitoloDetail.tsx` o ad altre pagine.

## File toccati

- `src/pages/ImmissionePolizzaPage.tsx` (unico file)

## Estensione futura (non in questo task)

Se in seguito vorrai applicare la stessa logica "campi-per-ramo" anche ad altri rami (es. Vita → beneficiari; Infortuni → professione/sport; Trasporti → tratta/merce), useremo lo stesso pattern: gruppo-ramo → blocco condizionale dedicato. Fammelo sapere e lo aggiungiamo.
