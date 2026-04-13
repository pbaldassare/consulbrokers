

## Piano: Rimuovere le route di Analisi Preventivo RCA, Import Titoli e Rientro Documenti

### Situazione attuale

La sidebar e la sitemap sono gia pulite — non contengono queste voci. Tuttavia le **route** in `src/routes/portafoglio.tsx` esistono ancora (righe 54, 56-58), rendendo le pagine accessibili via URL diretto.

### Cosa cambia

Rimuovere da `src/routes/portafoglio.tsx` le seguenti route:
- `/portafoglio/regolazioni` (riga 54)
- `/portafoglio/rientro-documenti` (riga 56)
- `/portafoglio/import-titoli` (riga 57)
- `/portafoglio/analisi-preventivo-rca` (riga 58)

E rimuovere l'import inutilizzato di `AnalisiPreventivoRCAPage` (riga 18).

### File coinvolto

| File | Azione |
|------|--------|
| `src/routes/portafoglio.tsx` | Rimuovere 4 route e 1 import |

