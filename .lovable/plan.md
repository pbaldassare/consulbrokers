## Obiettivo
Rimuovere pagine/componenti/route non più utilizzati senza toccare logiche esistenti. Solo cleanup.

## File da eliminare (zero import attivi)

**Pagine portafoglio legacy** (sostituite da dialog o mai usate):
- `src/pages/SospensionePolizzaPage.tsx` → sostituita da `SospensionePolizzaDialog`
- `src/pages/RiattivazionePolizzaPage.tsx` → sostituita da `RiattivazionePolizzaDialog`
- `src/pages/DuplicazionePolizzaPage.tsx` → placeholder TODO mai usato
- `src/pages/ConfermaEmittendePage.tsx` → placeholder TODO mai usato
- `src/pages/DiffProvvigioniPage.tsx` → placeholder TODO mai usato

**Pagine orfane** (nessun import nel codice, route già redirect o assente):
- `src/pages/GestionePolizzePage.tsx` (route `/portafoglio/gestione-polizze` già redirect a `/portafoglio/attive`)
- `src/pages/AnalisiPreventivoRCAPage.tsx`
- `src/pages/CreaNuovoUtente.tsx` (sostituita da `GestioneUtentiPrivilegi`)
- `src/pages/PortafoglioList.tsx` (sostituita da pagine `PortafoglioAttive/Carico/Storico`)

**Componenti orfani**:
- `src/components/polizze/RinnovoTitoloDialog.tsx` (nessun import — il flusso rinnovo passa altrove)

**Lib orfana**:
- `src/lib/formatDate.ts` (creata in audit Step 2, mai adottata)

## Modifiche route

In `src/routes/portafoglio.tsx`: rimuovere import e `<Route>` per:
- `/portafoglio/duplicazione`
- `/portafoglio/conferma-emittende`
- `/portafoglio/diff-provvigionali`
- `/portafoglio/sospensione`
- `/portafoglio/riattivazione`

(Le funzionalità Sospensione/Riattivazione sono già accessibili via dialog dentro `TitoloDetail`.)

## Aggiornamenti collaterali
- `public/version.json` bump
- `.lovable/audit-refactor.md`: marcare come completati gli item "codice morto sospetto"
- Memory `mem://navigation/legacy-pages-removed`: aggiungere le pagine appena rimosse

## Cosa NON tocco
- Nessuna logica business
- Nessuno schema DB / RLS / edge function
- Nessun componente UI shadcn
- Nessuna pagina ancora referenziata (anche se grossa: `TitoloDetail`, `ImmissionePolizzaPage`, `VociRcaCard`, ecc.)

## Verifica finale
- `bunx tsc --noEmit` per confermare zero import rotti
- Browse rapido per assicurarsi che nessuna voce sidebar/breadcrumb punti a route rimosse
