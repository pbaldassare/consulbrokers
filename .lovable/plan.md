## Diagnosi

Ho confermato il problema esaminando `src/pages/GestionePolizzePage.tsx` e lo schema della view `v_portafoglio_titoli`.

### Bug primario — il filtro "Cliente" non filtra la tabella

- `clientiOpts` carica i clienti da `public.clienti` e usa `clienti.id` come `value` (riga 234-240).
- La query risultati invece filtra così (riga 341):
  ```ts
  if (clienteId) q = q.eq("cliente_anagrafica_id", clienteId);
  ```
- Ma su `v_portafoglio_titoli` esistono **due colonne distinte**: `cliente_id` (FK → `clienti.id`) e `cliente_anagrafica_id` (FK → `anagrafiche_professionali.id`). L'ID scelto nella select è di tipo `clienti.id`, quindi il match su `cliente_anagrafica_id` torna **0 righe** quasi sempre.

Conseguenze visibili allo screenshot:
- la colonna "Cliente" mostra `—` per molte righe (sono titoli senza match anagrafica),
- selezionando un cliente la tabella si svuota o resta incoerente,
- l'utente quindi non riesce a "scegliere cliente + polizza" e l'azione "Esegui" non sembra fare quello che si aspetta (in alcuni casi naviga su una polizza non sua).

### Bug secondario — "Esegui Appendice non succede nulla"

`esegui()` per `appendice` chiama `navigate('/portafoglio/appendici?titoloId=' + row.id)`. La rotta esiste (`src/routes/portafoglio.tsx`) e `AppendiciPolizzaPage` legge `searchParams.get('titoloId')`. La navigazione **avviene**, ma quando il filtro cliente è rotto la riga su cui si clicca potrebbe non essere quella attesa, dando la sensazione che "non succeda nulla di corretto". Va comunque verificato visivamente con Playwright che la pagina si apra precompilata sulla polizza giusta per ogni operazione.

---

## Cosa fare

### 1. Fix filtro cliente (1 riga, `GestionePolizzePage.tsx`)
Sostituire il filtro al rigo 341:
```ts
if (clienteId) q = q.eq("cliente_id", clienteId);
```
Mantengo `clientiOpts` invariata (è la fonte UI giusta: anagrafica clienti).

### 2. Persistenza URL del cliente (allineamento)
`clienteId` è già inizializzato da `searchParams.get("cliente")` (riga 132) ma non viene mai sincronizzato nell'URL. Aggiungo l'effetto di scrittura `cliente=<uuid>` in `setSearchParams` insieme agli altri filtri (op, q, reg, …), così i deep link e il back/forward continuano a funzionare come per `reg`/`q`/`op`.

### 3. Verifica end-to-end di TUTTE le operazioni con Playwright

Per ogni operazione della barra:

| Operazione | Comportamento atteso |
|---|---|
| Appendice | naviga a `/portafoglio/appendici?titoloId=…` con polizza precompilata |
| Rinnovo | naviga a `/portafoglio/rinnovi?titoloId=…` |
| Precontrattuale | naviga a `/portafoglio/doc-precontrattuale?titoloId=…` |
| Carica Doc. | naviga a `/titoli/:id?tab=documenti` |
| Duplica / Storno / Sospensione / Riattivazione / Sostituzione | apre il rispettivo dialog con `target` valorizzato |
| Messa a Cassa | apre dialog `MessaCassaDialog` con titolo selezionato |
| Annulla / Annulla M.C. | apre `AlertDialog` corretto (admin only) |
| CIG Temporanei | naviga a `/titoli/:id` |
| Regolazioni Attese | naviga a `/titoli/:id?section=regolazione` |

Per ognuna seleziono un cliente reale dal filtro, verifico che la tabella si filtri, clicco "Esegui" sulla riga e prendo screenshot della pagina di destinazione / dialog aperto. Annoto eventuali altre rotture e le sistemo nello stesso giro (es. dialog che non si apre, rotta che non legge `titoloId`, permesso `canTitoli` calcolato male, ecc.).

### 4. E2E automatici

Aggiungo a `tests/e2e/10-regolazione-flag.spec.ts` (o in un nuovo `09-gestione-polizze-operazioni.spec.ts` se cresce troppo) due test:

- **filtro cliente filtra realmente**: seleziono il cliente del titolo di test → la riga compare e ha la colonna Cliente popolata; deseleziono → tornano più righe; URL contiene `cliente=<uuid>` e sopravvive a reload.
- **Esegui per ogni operazione**: per `appendice`, `precontrattuale`, `carica_doc`, `regolazioni_attese`, `cig_temporanei` verifico l'URL atteso dopo click; per i dialog (`messa_cassa`, `annulla`, `annulla_messa_cassa`) verifico `getByRole('dialog')` con titolo coerente.

### 5. Memory

Aggiorno `mem://insurance/policy-vs-quietanza-filtering` (o creo un nuovo `mem://insurance/gestione-polizze-cliente-filter`) con la nota: "in `v_portafoglio_titoli` usare sempre `cliente_id` (FK clienti) per i filtri di select cliente; `cliente_anagrafica_id` è la FK ad anagrafiche professionali ed è usato per altre lookup".

---

## File toccati

- `src/pages/GestionePolizzePage.tsx` — fix filtro `cliente_id` + sync URL `cliente`.
- Eventuali fix puntuali emersi dalla verifica Playwright (una operazione alla volta, sempre lato frontend/presentazione).
- `tests/e2e/09-gestione-polizze.spec.ts` (o nuovo file) — copertura filtro cliente + matrice operazioni.
- `mem://insurance/gestione-polizze-cliente-filter` — nuova memory.

## Fuori scope

- Nessuna modifica DB, RLS, edge function.
- Nessun ridisegno del flusso UX (resta "scegli op → filtra → Esegui per riga"); non introduco un wizard "scegli cliente + polizza + esegui in alto" perché non richiesto.