## Obiettivo

Distinguere visivamente Polizze e Quietanze nelle tabelle ClienteDetail e Portafoglio (Attive/Carico/Storico), con segmented control, badge colorati, bordo sinistro per riga, indentazione/connettore figlie, e link cliccabile sulla colonna "Polizza madre".

## Design tokens

Aggiungo in `src/index.css` (HSL, design system):

```css
--polizza: 173 80% 30%;          /* teal, alias di primary */
--polizza-foreground: 0 0% 100%;
--quietanza: 38 92% 50%;         /* amber */
--quietanza-foreground: 26 83% 14%;
--quietanza-soft: 38 92% 95%;    /* bg riga light */
--quietanza-soft-dark: 38 30% 12%; /* bg riga dark */
```

Aggiungo in `tailwind.config.ts` i colori `polizza`, `quietanza`, `quietanza-soft` mappati sulle variabili.

## Componente condiviso `TipoPolizzaBadge`

Nuovo file `src/components/polizze/TipoPolizzaBadge.tsx`:
- Props: `tipo: "polizza" | "quietanza"`, `numero?: number`, `totale?: number`.
- "Polizza" → badge pieno teal con icona `FileText`.
- "Quietanza N/M" → badge outline ambra con icona `Receipt`.
- Usa `Badge` shadcn con variant custom via `cva`.

## Componente condiviso `TipoFilterSegmented`

Nuovo file `src/components/polizze/TipoFilterSegmented.tsx`:
- Sostituisce il `Select` "Tipo".
- 3 chip: `Tutti` (neutro) · `Polizze` (teal pieno quando attivo) · `Quietanze` (ambra pieno quando attivo).
- Rounded-full container, smooth transition sullo sfondo del chip attivo.
- Props: `value`, `onChange`, opzionale `counts: { tutti, polizze, quietanze }` per chip con conteggio.

## Modifiche `PolizzeClienteTable` in `src/pages/ClienteDetail.tsx`

1. Sostituire il `Select` Tipo con `<TipoFilterSegmented>`.
2. Sostituire il badge testuale corrente con `<TipoPolizzaBadge>` (calcolando idx rata su catena).
3. Aggiungere classi `border-l-4 border-l-polizza` per madri e `border-l-quietanza` per quietanze sulla `<TableRow>`.
4. Background riga quietanza: `bg-quietanza-soft/40` (override sopra la zebra).
5. Colonna "N. Polizza": per le figlie aggiungere `pl-8` + glifo `└` davanti, font `text-muted-foreground font-normal`; madri restano `font-medium`.
6. Colonna "Polizza madre" nella vista flat quietanze: il numero diventa `<Button variant="link">` → `navigate(`/titoli/${madreId}`)`. Per ottenerlo, `computeFlatQuietanze` deve esporre anche `madreId` (`madre?.id ?? all[0].id`).

## Modifiche helper

`src/lib/polizzeClienteView.ts`:
- `computeFlatQuietanze` → ritorna `{ rata, madreNum, madreId, idx }`. Test esistenti aggiornati (campo opzionale, nessuna rottura).
- Aggiungo `computeTotaleRate(catena)` per `Quietanza N/M` (M = `catena.all.length`).

## Modifiche Portafoglio

Stesso pattern applicato a:
- `src/pages/PortafoglioAttivePage.tsx`
- `src/pages/PortafoglioCaricoPage.tsx`
- `src/pages/PortafoglioStoricoPage.tsx`

In queste 3 pagine: sostituire il filtro Tipo con `TipoFilterSegmented`, badge con `TipoPolizzaBadge`, bordo sinistro colorato per riga, colonna "Polizza madre" cliccabile (già presente la colonna in caso usi `v_portafoglio_titoli`, altrimenti aggiunta). Niente indentazione perché in Portafoglio non c'è la vista nested madre+figlie (le righe sono già flat).

## Test

Aggiornare `src/lib/__tests__/polizzeClienteView.test.ts` per `madreId` nel `computeFlatQuietanze` (1 test in più, gli 11 esistenti restano verdi).

## Cosa NON cambia

- Nessuna nuova libreria.
- Nessuna modifica a logica dati, RLS, query, paginazione.
- Stessa struttura tabella `Table` shadcn.
- Filtro `tutti | polizze | quietanze` invariato a livello logico — cambia solo il controllo UI.

## Memoria

Aggiornare `.lovable/memory/insurance/polizza-vs-quietanza-filtering.md` con i nuovi token visivi (`--polizza` / `--quietanza`) e i due nuovi componenti condivisi.