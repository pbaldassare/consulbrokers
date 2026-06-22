## Bug
In `src/pages/ClienteDetail.tsx` (tab Polizze del cliente) le righe quietanza navigano a `/quietanze/${r.id}`, ma `r.id` è un **`titoli.id`** (le rate vivono come record `titoli` collegati via `sostituisce_polizza`, non come righe della tabella `quietanze`).

Il route `/quietanze/:id` (`QuietanzaDetailRedirect`) interroga la tabella `quietanze` con quell'id, **non trova nulla** e fa `Navigate("/portafoglio/attive")`. Da qui la sensazione "non le trova".

## Fix
Sostituire la navigazione delle righe quietanza in `src/pages/ClienteDetail.tsx`:

- riga ~1310 (tab "Quietanze" piatta): `navigate(\`/quietanze/${r.id}\`)` → `navigate(\`/titoli/${r.id}\`)`
- riga ~1418 (rate espanse sotto la madre): stessa sostituzione

Nessuna altra modifica: il pannello `TitoloQuietanzePanel` già naviga correttamente a `/titoli/{id}`, e `PolizzaDetail.tsx` (che usa la tabella `quietanze` vera) resta invariato — lì `r.id` è davvero un `quietanze.id`.

## Verifica
- Click su una quietanza dal cliente Trotta Bus → apre `/titoli/<id-rata>` (TitoloDetail della rata).
- La rata corrente (Rata 2/2) non deve cambiare comportamento.
