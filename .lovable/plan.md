## Cosa ho capito

1. **Grafica più compatta e leggibile** — sia su `PolizzaDetail` (vista Contratto + tabella Quietanze) sia su `QuietanzaDetail` (le 4 card Periodo/Importi/Messa a cassa/Riferimenti) le card sono troppo dispersive, con tanto spazio vuoto e label/valori sbilanciati. Vanno rese più dense, centrate visivamente, con gerarchia chiara (label piccola, valore in evidenza), padding ridotto, separatori sottili invece di righe enormi.

2. **Azioni unificate Polizza ↔ Quietanza** — oggi la toolbar (Sospendi, Sostituisci, Estingui, Storno, Appendici, Precontrattuale, Annulla polizza) compare solo sul dettaglio polizza. La stessa toolbar deve esistere anche su `QuietanzaDetail`:
   - Su **polizza** (madre) → al click su un'azione che agisce su una rata specifica (es. Storno, Messa a cassa, ecc.), si apre un piccolo selettore "Su quale quietanza?" con la lista delle 9 rate.
   - Su **quietanza** → l'azione parte direttamente sulla rata corrente, senza chiedere nulla (la quietanza è già il contesto).
   - Azioni che restano sempre a livello polizza (Sostituisci, Estingui, Annulla polizza, Sospendi l'intera polizza, Precontrattuale) compaiono anche su quietanza ma agiscono sulla polizza madre, senza prompt.

## Piano

### Fase 1 — Restyling card (solo presentazione, niente logica)
- **`src/pages/QuietanzaDetail.tsx`** — convertire le 4 card in un layout più denso:
  - padding card da `p-6` → `p-4`, titoli più piccoli (`text-sm font-semibold uppercase tracking-wide text-muted-foreground`).
  - righe label/valore con `flex justify-between py-1.5 border-b border-border/40 last:border-0`, valori in `font-medium tabular-nums`, importi a destra allineati.
  - griglia 2 colonne su desktop già ok, ma centrare con `max-w-5xl mx-auto` e gap ridotto.
- **`src/pages/PolizzaDetail.tsx`** (tab Contratto) — stessa riduzione di padding/altezze righe, raggruppamenti più stretti.
- **Tabella Quietanze** (in `PolizzaDetail.tsx`) — righe più compatte (`h-10` invece di default), colonne `—` sostituite da testo muted, badge "Da incassare" più piccolo.

### Fase 2 — Toolbar azioni condivisa
- Estrarre l'attuale toolbar di `PolizzaDetail` in un componente riusabile **`src/components/titolo/AzioniPolizzaToolbar.tsx`** con props:
  - `polizzaId: string`
  - `currentQuietanzaId?: string` (presente solo quando si è sulla quietanza)
  - `quietanze: Array<{ id, numero_rata, stato, ... }>` (per il selettore)
- Comportamento per ogni azione:
  - **Sospendi / Sostituisci / Estingui / Annulla / Precontrattuale** → azioni "polizza-level": stesso comportamento ovunque, non chiedono rata.
  - **Storno / Messa a cassa / Appendici** → azioni "rata-level":
    - Se `currentQuietanzaId` è definito → eseguono direttamente su quella rata.
    - Altrimenti → aprono un `Dialog` "Seleziona quietanza" con la lista delle rate (numero, decorrenza, stato) e procedono con la rata scelta.
- Montare il componente sia in `PolizzaDetail` sia in `QuietanzaDetail`, passando il context corretto.

### Fase 3 — Verifica
- Controllo visivo con Playwright sulle 2 pagine (polizza `RCM00010074404` e quietanza 1/9).
- Verifica che da quietanza il bottone Storno parta diretto, da polizza apra il selettore.

## Cosa NON tocco
- Logica DB / RLS / migrazioni.
- Calcoli importi, frazionamento, generazione rate.
- Rotte e breadcrumb (già ok).

## Dettagli tecnici
- Niente nuove dipendenze; uso `Dialog`, `Command`, `Button` shadcn già presenti.
- Le mutation esistenti per Storno/Messa a cassa/Sospendi accettano già un `titoloId` → basta passare quello giusto in base al contesto.
- Nessun cambio a `src/integrations/supabase/types.ts`.

Confermi che procedo così? In particolare confermami quali azioni consideri "rata-level" (con selettore su polizza) e quali "polizza-level" (sempre dirette) — la mia proposta sopra è quella standard ma se preferisci una mappatura diversa dimmela.