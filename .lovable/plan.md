
## Richiesta
Sul dettaglio titolo (`/titoli/:id`), la freccia "indietro" accanto al titolo "Polizza 332437571" deve portare al **Carico del Mese** (`/portafoglio-carico`) invece che alla destinazione attuale.

## Da verificare
- `src/pages/TitoloDetail.tsx` — trovare il bottone freccia accanto al titolo e capire dove punta ora (probabile `navigate(-1)` o `/portafoglio` generico).

## Fix
Cambiare l'`onClick` della freccia in `navigate("/portafoglio-carico")`.

### File toccato
- `src/pages/TitoloDetail.tsx` — una sola riga modificata sull'handler della freccia accanto al numero polizza.

### Nota
Confermo che vuoi sempre andare al **Carico del Mese**, anche se l'utente è arrivato al titolo da Polizze Attive o Storico? Se sì procedo così; altrimenti posso usare `navigate(-1)` per tornare alla pagina precedente reale (più "intelligente" ma meno prevedibile). Default proposto: forzo `/portafoglio-carico` come da richiesta.
