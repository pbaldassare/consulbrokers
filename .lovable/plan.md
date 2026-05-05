## Obiettivo

Sostituire ovunque nelle UI la label "Compagnia/Compagnie" con "Agenzia/Agenzie" (riferita ai record della tabella `compagnie`, che in realtà sono mandatarie/agenzie tipo ASSISUD). Nessuna modifica al DB e nessuna modifica al gruppo finanziario "Compagnie" (es. HDI, Generali) che resta tale.

## Convenzione

- "Compagnia" → "Agenzia"
- "Compagnie" → "Agenzie"
- "compagnia" / "compagnie" (minuscolo) idem
- `Gruppo Compagnia` resta invariato (è il gruppo della reale compagnia assicurativa, es. HDI).

## Aree da aggiornare (solo testo visibile)

- **Sidebar / menu** (`src/components/AppSidebar.tsx`, `src/routes/*`): voce "Compagnie" → "Agenzie".
- **Pagine elenco/dettaglio**:
  - `src/pages/CompagnieList.tsx`, `AnagraficheCompagniePage.tsx`, `FlussiCompagnieList.tsx`, `FlussoCompagniaDetail.tsx`
  - Header/title, breadcrumb, placeholder ricerca, bottoni "Nuova Compagnia" → "Nuova Agenzia"
- **Colonne tabelle e label form**: Portafoglio (Attive/Carico/Storico), Titoli, Sinistri, Trattative, Estrazioni, Provvigioni, Rimesse, Contabilità, Report, Dashboard, CFO drill-down, ClienteDetail, ProspectDetail, TitoloDetail, ImmissionePolizza, RinnoviPolizza, DocPrecontrattuale, EmailTemplate, ECAgenzia/Compagnia/Cliente PDF.
- **Toast e messaggi**: messaggi tipo "Seleziona compagnia" → "Seleziona agenzia".
- **PDF generati** (`ec-cliente-pdf.ts`, `ec-produttore-pdf.ts`, `precontrattuale-pdf.ts`, `genera-distinta-pdf`): intestazioni colonne.

## Cosa NON cambia

- Nomi tabelle/colonne DB (`compagnie`, `gruppo_compagnia_id`, `gruppi_finanziari` etc.).
- Tipi TypeScript generati da Supabase.
- Chiavi React Query (`["compagnie", ...]`).
- Rotte URL (`/compagnie`, `/anagrafiche/compagnie`) — restano per non rompere bookmark.
- Variabili, props, nomi file.
- Memorie progetto e commenti tecnici.
- Etichetta "Gruppo Compagnia" (riferita al vero ente assicurativo).

## Approccio

1. Estrazione di tutte le occorrenze user-facing con `rg` filtrato su stringhe dentro JSX/`title`/`label`/`placeholder`/`toast`.
2. Sostituzione manuale file-per-file rispettando maiuscole/minuscole e singolare/plurale.
3. Verifica visiva su: Sidebar, `/compagnie`, `/portafoglio/carico`, TitoloDetail, Dashboard, AreaCFO, EstrazioniStampe.
4. Aggiornamento memoria `mem://insurance/company-management` per riflettere nuova label UI ("Agenzia") mantenendo mapping DB → `compagnie`.

## Out of scope

- Modifiche al modello dati o al campo `tipo_mandatario`.
- Rinomina rotte, chiavi, variabili, tabelle.
- Cambio della label "Compagnia" nei contesti che si riferiscono al **gruppo assicurativo** vero (es. dropdown "Gruppo Compagnia / Gruppo Finanziario").
