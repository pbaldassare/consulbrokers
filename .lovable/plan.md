

## Analisi

Nello screenshot della pagina **Carico del Mese** (`/portafoglio/carico`) compare un pulsante "Messa a Cassa" che l'utente vuole rimuovere da questa specifica pagina.

## Fix

Modifica mirata in **`src/pages/PortafoglioCaricoPage.tsx`**:
- Individuare il pulsante "Messa a Cassa" (probabilmente nell'header o nella toolbar della pagina)
- Rimuoverlo (insieme all'eventuale handler/dialog se non usato altrove nella stessa pagina)

Se il pulsante è anche per riga (azione su singola polizza nella tabella), chiedo conferma se nascondere anche quello — ma dallo screenshot sembra essere un pulsante globale di pagina.

## Cosa NON faccio

- Non rimuovo la funzionalità "Messa a Cassa" dal sistema (resta disponibile dove serve, es. dettaglio titolo / altre viste portafoglio)
- Nessuna modifica a `MessaCassaDialog.tsx` (componente condiviso)
- Nessuna modifica DB / RLS / logica di business

## File toccati

- `src/pages/PortafoglioCaricoPage.tsx` (~3-10 righe rimosse)

## Verifica post-fix

1. Apro `/portafoglio/carico` → il pulsante "Messa a Cassa" non è più visibile
2. Apro un'altra pagina dove la Messa a Cassa serve (es. dettaglio titolo) → il flusso funziona ancora

