## Obiettivo
Far sì che il contenuto dei 4 select in "Cliente & Sede" (Sede · Account Executive · Produttore · Specialist) sia leggibile per intero, senza troncamento "...".

## Causa
La riga usa `lg:grid-cols-4`: a viewport ~1070px ogni cella è ~250px e il testo dei select viene troncato (es. "001 - Ufficio di N…", "GUARRACINO G…").

## Modifica (un solo file: `src/pages/ImmissionePolizzaPage.tsx`)

Sezione Cliente & Sede, contenitore dei 4 campi:
- Sostituire `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` con `grid-cols-1 md:grid-cols-2 xl:grid-cols-4`.
  - Sotto i 1280px → 2x2 (ogni campo ha ~500px → mostra il testo completo).
  - Da 1280px in su → 4 colonne affiancate.
- Aggiungere `min-w-0` ai 4 wrapper `<div className="space-y-1.5 …">` per consentire lo shrink corretto del trigger del SearchableSelect dentro il grid.

Nessun'altra modifica funzionale o di salvataggio.

## Fuori scope
- Nessun cambio a stato, query, payload o DB.
