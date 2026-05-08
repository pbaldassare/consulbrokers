## Obiettivo
Unificare la card **Messa a Cassa** dentro la card **Operazioni** in `src/pages/TitoloDetail.tsx`, mantenendo i tre campi data e i pulsanti Incassa/Garantito/Annulla ben organizzati visivamente, senza modifiche a logica/business.

## Layout proposto (single card "Operazioni")

```text
┌─ Operazioni ────────────────────────────────────────────────┐
│  [Sospensione][Riattivazione][Duplicazione][Rinnovo]        │
│  [Appendici][Storno][Regolazione][Precontrattuale][Annull.] │
│ ─────────────────────────────────────────────────────────── │
│  💲 Messa a Cassa                          [stato badge]    │
│  ┌─ Date ───────────────────────────────────────────────┐   │
│  │ Data Messa a Cassa │ Data Pagamento │ Data Decorr.  │   │
│  │     [____]         │     [____]     │    [____]     │   │
│  └──────────────────────────────────────────────────────┘   │
│  Tipo Pag.: bonifico · Banca: XYZ                           │
│  [Badge: Garantito] [Fondi Ricevuti / In Attesa Fondi]      │
│  ⓘ banner anti-doppio-incasso (se applicabile)              │
│  [✓ Incassa] [🛡 Garantito] [✗ Annulla Incasso]              │
└─────────────────────────────────────────────────────────────┘
```

- Sotto-sezione **Messa a Cassa** introdotta da un `Separator` + intestazione interna con icona `DollarSign` e badge stato (`attivo` / `incassato` / `poliennale`).
- Le 3 date in `grid-cols-3` (responsive `sm:grid-cols-3`, mobile stack), con label uniformi e input compatti (`h-9`).
- Riga inline `Tipo Pagamento · Banca` (mostrata solo se `incassato`).
- Riga separata per i badge Garantito/Fondi e relativi mini-pulsanti.
- I tre pulsanti azione (Incassa, Garantito, Annulla) raggruppati in una toolbar a destra/sotto, separata visivamente dalla toolbar operazioni superiore.

## Modifiche a `src/pages/TitoloDetail.tsx`

1. **Rimuovere** la `<Card>` autonoma "Messa a Cassa" (righe ~1471–1603).
2. **Estendere** la card "Operazioni" (righe ~1309–1374): dopo la toolbar dei pulsanti operazione, aggiungere un blocco condizionale `{(t.stato === "attivo" || t.stato === "incassato") && showMessaACassa && (…)}` con:
   - `<Separator className="my-3" />`
   - Header interno (`<div className="flex items-center justify-between"><h4>...DollarSign + Messa a Cassa</h4><Badge>...</Badge></div>`)
   - Grid date (logica identica a oggi: input editabili se `incassato`, FieldRow "—" altrimenti)
   - Riga Tipo Pag./Banca
   - Badges Garantito/Fondi (logica invariata)
   - Banner info doppio-incasso (invariato)
   - Toolbar pulsanti Incassa/Garantito/Annulla (invariata)
3. Per il caso `t.stato === "sospeso"`: la sezione Messa a Cassa non è visibile (lo è già oggi, perché in quel ramo si renderizza solo la card "Polizza Sospesa"). Nessuna modifica.
4. Per `t.stato === "scaduto"`: già nascosta sia Operazioni sia Messa a Cassa. Nessuna modifica.
5. Nessuna modifica a:
   - dialog (Conferma Messa a Cassa, Garantito, Annulla password)
   - mutation (`changeStatoMutation`, `updateDateMutation`, `segnaFondiRicevutiMutation`, `annullaFondiMutation`)
   - logica `showMessaACassa`, `isPoliennale`, `isAdmin`
   - business rules (anti-doppio-incasso, poliennali, ecc.)

## Out of scope
- Nessuna modifica a edge functions, migrations, calcoli provvigioni, RLS.
- Nessuna modifica al wording delle label esistenti.
- Nessun cambio comportamentale: solo riorganizzazione visiva/layout.
