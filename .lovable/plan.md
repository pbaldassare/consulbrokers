## Obiettivo

Nascondere il bottone **Rinnovo** dalla card Operazioni del dettaglio titolo, dato che il rinnovo è ora gestito automaticamente dalla quietanza generata su messa a cassa.

## Modifica

In `src/pages/TitoloDetail.tsx` (righe 1440–1446) rimuovere il `<Button>` "Rinnovo" e il relativo trigger `setRinnovoDialogOpen(true)`. Lasciare montato il `RinnovoTitoloDialog` non serve: rimuovo anche state `rinnovoDialogOpen`, l'import di `RinnovoTitoloDialog` e l'istanza JSX del dialog se non più referenziata altrove.

## Verifica

- Aprire `/titoli/01047f9e-...` → la card Operazioni non mostra più "Rinnovo".
- Build pulita, nessun import inutilizzato.
