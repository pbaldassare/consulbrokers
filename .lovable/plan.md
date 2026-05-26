## C3 — Split TitoloDetail.tsx (3460 LOC) — refactor conservativo

Obiettivo: ridurre la complessità del file senza toccare logica, query, mutation o markup. Solo estrazione di blocchi presentazionali in sotto-componenti dello stesso folder, con prop typing strict.

### Strategia

NON usare React.lazy, NON cambiare ordine di useEffect/useState, NON modificare query keys, NON refactor di mutation. Solo "cut & paste" di blocchi JSX + props pass-through.

Tutti i nuovi componenti vivono in `src/components/titolo/sections/` per non disturbare gli import esistenti di `@/components/titolo/TitoloTabs`.

### Sezioni da estrarre (in ordine di rischio crescente)

1. **`TitoloHeaderBar`** — header con back button, badges (stato, sospesa, stornata, quietanza/madre), numero polizza, contraente. ~80 righe. Props: `titolo`, `polizzaMadre`, `onBack`. Rischio: minimo.

2. **`TitoloOperazioniCard`** — la Card "Operazioni" (righe 1632-1880 ca.): bottoni Sospendi/Riattiva/Sostituisci/Estingui/Storna/Regolazione + i relativi `Dialog` lift state. Props: `titolo`, `canEdit`, callbacks per ricarica. Rischio: medio (molti dialog), ma sono già componenti standalone — passiamo solo `open/onOpenChange`.

3. **`TitoloPolizzaPanel`** — wrapper attorno a `<PolizzaSection>` con i suoi handler `onChange` e `onSave` (la sezione condivisa con Immissione). Già componente, basta estrarre il binding. Rischio: basso.

4. **`TitoloQuietanzaPanel`** — pannello "Isolamento Quietanza" (banner + dati rata) presente quando `isQuietanza`. Rischio: basso.

5. **`TitoloProvvigioniCard`** — riepilogo provvigioni generate (lettura `provvigioni_generate`). Rischio: basso (solo read).

Mutation, query, useState, useEffect, useMemo, helper locali (`assertSameTitolo`, calcoli mora, ricalcolo frazionamento) RIMANGONO nel componente padre. Si passano callback già esistenti via props.

### Cosa NON tocco in questo step

- `TitoloTabs` (già estratto, ok).
- `VociRcaCard`, `PolizzaSection`, dialog di operazione (già componenti).
- Auto-quietanza, sync firma→quietanza, guard `assertSameTitolo`.
- Nessuna estrazione di hook custom (rinviato a C3b se serve).

### Verifica

1. Build green.
2. Smoke nel preview: apertura titolo, modifica un campo, salvataggio, apertura dialog Sospendi, chiusura.
3. Diff: ogni sezione estratta deve essere byte-identica al JSX precedente, solo "scope lift" delle prop.

### File toccati

| File | Tipo |
|---|---|
| `src/components/titolo/sections/TitoloHeaderBar.tsx` | nuovo |
| `src/components/titolo/sections/TitoloOperazioniCard.tsx` | nuovo |
| `src/components/titolo/sections/TitoloPolizzaPanel.tsx` | nuovo |
| `src/components/titolo/sections/TitoloQuietanzaPanel.tsx` | nuovo |
| `src/components/titolo/sections/TitoloProvvigioniCard.tsx` | nuovo |
| `src/pages/TitoloDetail.tsx` | sostituzione blocchi JSX con i nuovi componenti |
| `public/version.json` | bump |

Target: TitoloDetail.tsx scende da ~3460 a ~1900-2100 LOC senza cambiamenti di comportamento.

### Domanda

Procedo con questo ambito (5 sezioni, solo presentazionali) o preferisci limitarmi a 1-2 sezioni a basso rischio (Header + Quietanza) come primo step prudente?