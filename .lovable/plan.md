## Obiettivo

1. Eliminare le tab **Executive** e **Prod. Sede** dalla gestione anagrafiche (non più usate).
2. Sostituire la pagina unica `Anagrafiche Professionali` con **due pagine separate**:
   - **Anagrafiche Compagnie** → Liquidatori, Periti, Legali (figure esterne nominate dalle compagnie).
   - **Anagrafiche Interne** → Account Executive, Produttori, Resp. Sede (figure interne all'agenzia).
3. Rimuovere la voce "Anagrafiche Professionali" dalla sidebar e sostituirla con le due nuove voci.

## Verifica dati esistenti

Query DB conferma:
- `executive`: **0 record** → tab eliminabile senza perdita.
- `produttore_sede`: **0 record** → tab eliminabile senza perdita.
- `liquidatore` 12, `perito` 8, `legale` 5 → andranno nella pagina Compagnie.
- `account_executive` 186, `corrispondente` 250, `responsabile_sede` 186 → andranno nella pagina Interne.

La tabella DB `anagrafiche_professionali` resta unica (tutto il resto del sistema vi punta — sinistri, titoli, polizze, contabilità, edge functions). Cambia solo l'interfaccia di gestione, filtrando per `tipo`.

## Modifiche

### 1. Nuove pagine
- `src/pages/AnagraficheCompagniePage.tsx` — gestione di **liquidatore / perito / legale** (3 tab). Riusa la stessa logica/markup dell'attuale pagina ma limitando `TIPI` a questi tre valori e mantenendo solo le viste tabella + form pertinenti (peritiLegali / liquidatore).
- `src/pages/AnagraficheInternePage.tsx` — gestione di **account_executive / corrispondente / responsabile_sede** (3 tab). Riusa la logica commerciale (AE / Corr / Sede) dell'attuale pagina; mantiene il dropdown "Sede" come oggi.

Entrambe le pagine sono adattamenti dell'attuale `AnagraficheProfessionaliPage.tsx`, non riscritture.

### 2. Routing (`src/routes/archivi.tsx`)
- Rimuovere `<Route path="/archivi/anagrafiche" …>`.
- Aggiungere:
  - `/archivi/anagrafiche-compagnie` → `AnagraficheCompagniePage`
  - `/archivi/anagrafiche-interne` → `AnagraficheInternePage`
- Mantenere `/archivi/anagrafiche` come **redirect** a `/archivi/anagrafiche-interne` per non rompere link/bookmark esistenti (incluso `getDefaultRoute.ts` e `Dashboard.tsx`).

### 3. Sidebar (`src/components/AppSidebar.tsx`)
Sostituire l'unica voce "Anagrafiche Professionali" con due voci:
- "Anagrafiche Compagnie" → `/archivi/anagrafiche-compagnie` (icona `Scale` o `Building2`)
- "Anagrafiche Interne" → `/archivi/anagrafiche-interne` (icona `Briefcase`)

Il permesso `anagrafiche` controlla entrambe (nessun cambio al sistema permessi).

### 4. File da rimuovere
- `src/pages/AnagraficheProfessionaliPage.tsx` (sostituita dalle due nuove).

### 5. Pulizia tipi obsoleti
Nelle nuove pagine NON includere i valori `executive` e `produttore_sede` nell'array `TIPI`. La validazione DB (`validate_anagrafiche_professionali_tipo`) li accetta ancora ma non saranno più creabili dall'UI. Nessuna migration necessaria (zero record da migrare).

## File interessati

- creato: `src/pages/AnagraficheCompagniePage.tsx`
- creato: `src/pages/AnagraficheInternePage.tsx`
- modificato: `src/routes/archivi.tsx`
- modificato: `src/components/AppSidebar.tsx`
- eliminato: `src/pages/AnagraficheProfessionaliPage.tsx`

## Fuori scope

- Nessuna modifica a tabella DB, RLS, edge functions, o relazioni (sinistri/titoli/contabilità continuano a funzionare).
- Nessun cambio ai permessi (`permessi_json.anagrafiche` resta unico).
