
## Sintomo

Stai compilando la polizza moto in `/portafoglio/immissione?clienteId=…`, modifichi data e premio, e la **pagina si ricarica davvero** (URL refresh), perdendo tutto. Hai confermato che non clicchi "Salva" e ti aspetti che almeno i campi restino lì.

## Cause individuate

Ci sono due meccanismi indipendenti che convergono sullo stesso effetto "ho perso i dati":

1. **AppVersionGuard forza reload del bundle** (`src/components/AppVersionGuard.tsx` + `src/lib/versionCheck.ts`). Polla `/version.json` ogni `POLL_MS` ed esegue `window.location.reload()` se vede un version mismatch (throttle 30s anti-loop). In dev/preview Lovable il `version.json` cambia spesso → la pagina si ricarica davvero mentre compili. Nessuna guardia per "form con bozza non vuota in corso".

2. **Effect di reset righe premio** (`ImmissionePolizzaPage.tsx` linee 981-998, dipendenza `[isRCA]`). Ogni volta che `isRCA` cambia (anche perché `gruppiRamo`/`ramiList` arrivano in due tempi o perché tocchi `polizzaAuto`), azzera `premiFirmaRows`, `premiQuietanzaRows`, e tutti i campi veicolo/conducente — anche se contengono già dati che stavi inserendo. Stesso reset esplicito anche su `RamoSottoramoSelect.onChange` (linea 1887-1888).

3. **Bozza riallineata su key change**. Il `draftKey` (linea 446) è `immissione:v1:${selectedClienteId || preselectedClienteId || "new"}`. Al primo render parte da `new` (perché `selectedClienteId` è vuoto), poi l'effect 706-711 lo allinea a `preselectedClienteId` → il key cambia → l'hydration effect 451 ri-parte (loadDraft dell'altra key) e può sovrascrivere campi già toccati nei primi 200ms. È un piccolo race ma contribuisce al "vedo i campi che si svuotano".

## Fix proposto (frontend only)

### A) Mettere il guinzaglio all'AppVersionGuard sulle pagine "form aperto"

- In `src/lib/versionCheck.ts`, dentro `forceReload(...)`, aggiungere una condizione `canReloadNow()` che ritorna `false` se:
  - `document.visibilityState !== "visible"`, **oppure**
  - esiste almeno un `<input>/<textarea>/<select>` focusato con `:focus`, **oppure**
  - una flag globale `window.__lovableFormDirty === true` è attiva.
- In `ImmissionePolizzaPage.tsx`, settare `window.__lovableFormDirty = true` quando `draftHydrated && !!draftSnapshot.numeroPolizza || …` (basta tenerlo "dirty" finché la pagina è montata e ha un draft attivo). Pulirla in unmount e dopo salvataggio/`clearDraft`.
- L'aggiornamento resta in coda: appena la pagina viene smontata o l'utente cambia tab, al prossimo poll il reload parte. Niente loop perché il throttle 30s esistente continua a funzionare.

### B) Evitare il reset distruttivo delle righe premio

- Cambiare l'effect 981 in modo che NON azzeri se le righe contengono già dati inseriti. Pseudocodice:

  ```ts
  useEffect(() => {
    if (isRCA) return;
    // reset solo se le righe sono "vuote/default" (nessun netto, nessun sottoramo, nessuna targa, ecc.)
    const hasUserData =
      premiFirmaRows.some(r => r.netto || r.tasse || r.sottoramoId) ||
      premiQuietanzaRows.some(r => r.netto || r.tasse || r.sottoramoId) ||
      !!vTarga || !!vMarca || !!vModello;
    if (hasUserData) return;
    // …reset come oggi…
  }, [isRCA]);
  ```

- Stesso ragionamento per `RamoSottoramoSelect.onChange` (linee 1884-1890): mostrare un piccolo `confirm()` (o `toast` con undo) prima di azzerare le righe se contengono importi, invece di buttarle via in silenzio.

### C) Stabilizzare la bozza alla prima entrata con `?clienteId=…`

- Inizializzare `selectedClienteId` direttamente da `preselectedClienteId` in `useState(() => preselectedClienteId ?? "")`, in modo che il `draftKey` sia stabile dal primo render e l'hydration giri una sola volta. Rimuovere (o tenere come fallback) l'effect 706-711.

## File toccati

- `src/lib/versionCheck.ts` — guard `canReloadNow()`.
- `src/components/AppVersionGuard.tsx` — nessuna modifica funzionale (continua a pollare; il blocco è centralizzato in `versionCheck.ts`).
- `src/pages/ImmissionePolizzaPage.tsx` —
  - flag `window.__lovableFormDirty` su mount/unmount;
  - `useState` iniziale di `selectedClienteId` da query string;
  - guardia "hasUserData" nell'effect `[isRCA]`;
  - conferma prima del reset righe premio in `RamoSottoramoSelect.onChange`.

## Cosa NON tocco

- La struttura DB e le RLS.
- La logica di calcolo provvigioni/IPT/SSN.
- Le altre pagine (`TitoloDetail`, `PortafoglioDetail`, ecc.).
- Il debounce di salvataggio bozza (`useDraftPersistence`).

## Verifica

1. Aprire `/portafoglio/immissione?clienteId=…`, compilare Ramo + Premio + Data, lasciare la tab aperta più di un minuto: nessun reload finché c'è focus o `formDirty`.
2. Cambiare Ramo dopo aver inserito un premio: chiede conferma prima di buttare le righe.
3. Cliccare/togliere "Polizza Auto" su un ramo R.C.A. con premi già compilati: le righe restano.
4. Refresh manuale (F5): la bozza viene ripristinata e parte dal cliente corretto senza re-hydration in due passi.
