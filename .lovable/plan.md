

## Piano: Nascondere la sezione Contabilità Generale

### Cosa farò

Commentare o rimuovere il gruppo "Cont. Generale" dall'array dei menu items in `src/components/AppSidebar.tsx` (righe ~157-173). Questo nasconde l'intera sezione dalla sidebar senza toccare le pagine o le route — se in futuro serve, basta riabilitarla.

Rimuoverò anche le route corrispondenti da `src/App.tsx` (o dal file route dedicato) per evitare che qualcuno acceda direttamente via URL.

### File coinvolti

| File | Modifica |
|------|----------|
| `src/components/AppSidebar.tsx` | Rimuovo il blocco del gruppo "Cont. Generale" (righe 157-173) |
| File route che monta le pagine `/cont-generale/*` | Commento/rimuovo le route |

Le pagine stesse restano nel repo — non le cancello, così si possono riattivare facilmente.

