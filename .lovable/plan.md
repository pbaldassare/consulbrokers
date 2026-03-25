

## Piano: Armonizzazione UI Pagine Contabilita

### Problema
Le 5 pagine contabili usano stili KPI e layout diversi tra loro:
- **ContabilitaUfficio**: KPI inline dentro `CardContent pt-6`, nessun bordo laterale, font `text-2xl`
- **CruscottoGiornaliero**: KPI con `border-l-4`, `CardHeader/CardDescription/CardTitle text-xl`, grid 6 colonne
- **DistintaGiornaliera**: KPI con `border-l-4`, `CardHeader pb-1 pt-4 px-4`, grid 5 colonne
- **QuadraturePremi**: KPI con `border-l-4`, `CardHeader pb-2`, `CardTitle text-xl`, grid 5 colonne
- **ChiusuraContabile**: Nessun KPI, progress bar custom

### Stile target unificato

Adottare il pattern piu pulito gia in uso (Cruscotto/Quadratura), con queste regole:

1. **KPI Card standard**: `border-l-4 border-l-{color}`, `CardHeader pb-2`, `CardDescription` con icona + label `text-xs`, `CardTitle text-xl`, `CardContent` con sotto-testo `text-xs text-muted-foreground`
2. **Header pagina**: `h1 text-2xl font-bold` + `p text-sm text-muted-foreground` a sinistra, azioni a destra con `flex items-center gap-2`
3. **Grid KPI**: `grid grid-cols-2 md:grid-cols-4 gap-4` (4 KPI) oppure `md:grid-cols-3 lg:grid-cols-5` (5 KPI), mai 6 colonne
4. **Progress bar**: Usare il componente `Progress` invece di div custom
5. **Tabelle**: Stile uniforme con `Card > CardContent pt-4 > Table`
6. **Spaziatura**: `space-y-6` come wrapper principale

### Modifiche per file

| File | Cosa cambia |
|------|-------------|
| `ContabilitaUfficio.tsx` | Riscrivere KPI cards con pattern standard (border-l-4, CardHeader/CardDescription/CardTitle). Usare `fmt()` per importi. Allineare header con stile consistente |
| `CruscottoGiornaliero.tsx` | Ridurre grid da 6 a 2 righe (3+3 o 4+2). Uniformare padding CardHeader. Aggiungere `CardContent` consistente dove manca |
| `DistintaGiornaliera.tsx` | Uniformare padding KPI cards (`pb-2` invece di `pb-1 pt-4 px-4`). Aggiungere `CardContent` con sotto-info |
| `ChiusuraContabile.tsx` | Sostituire progress bar `div` custom con componente `Progress`. Uniformare header |
| `QuadraturePremi.tsx` | Gia quasi allineata, piccoli fix padding e grid breakpoints |

### Dettagli tecnici

- Nessuna modifica funzionale, solo CSS/layout
- Nessuna nuova dipendenza
- Formattazione importi: usare `Intl.NumberFormat` ovunque (gia presente come `fmt()`)
- Breakpoints responsivi uniformi: `grid-cols-2 md:grid-cols-4` per 4 KPI, `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` per 5+

