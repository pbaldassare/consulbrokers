

## Piano: Miglioramento Grafico Generale con piu Colore

### Problema attuale
L'interfaccia e molto neutra/grigia: sidebar bianca, topbar bianca, pagine con sfondo quasi bianco, card senza accenti di colore. Manca personalita visiva coerente con il brand teal/petrol di ConsulNet.

### Interventi

**1. Sidebar — Gradient teal/petrol**
- Sfondo con gradient verticale da `hsl(199, 58%, 18%)` a `hsl(199, 58%, 26%)`
- Testo chiaro (bianco/grigio chiaro) invece di grigio scuro
- Voci attive con sfondo bianco semi-trasparente invece di bg pieno
- Brand "ConsulNet" in bianco
- File: `src/components/AppSidebar.tsx`, `src/index.css`

**2. Topbar — Accento colorato**
- Sottile linea accent teal sul bordo inferiore (border-bottom gradient)
- Avatar utente con bordo accent
- File: `src/components/Topbar.tsx`

**3. Card e pagine — Accenti di colore**
- Header delle Card principali (CardHeader) con sottile bordo sinistro colorato (accent left border) nelle pagine lista
- Tab attive con underline teal invece di sfondo generico
- File: `src/index.css` (utility classes globali)

**4. Tabelle — Righe alternate e header colorato**
- Header tabella con sfondo teal leggero (`bg-primary/5`)
- Righe alternate con sfondo alternato leggero
- File: `src/index.css`

**5. Badge e bottoni — Piu vivaci**
- Bottone primario con leggero gradient teal
- Badge di stato piu saturati
- File: `src/index.css`

**6. Login page — Sfondo colorato**
- Sfondo gradient teal/petrol nella pagina login per dare impatto visivo
- File: `src/pages/LoginPage.tsx`

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| File modificati | `src/index.css`, `src/components/AppSidebar.tsx`, `src/components/Topbar.tsx`, `src/pages/LoginPage.tsx` |
| Palette | Teal/petrol esistente (--primary, --accent) usata in modo piu esteso |
| Approccio | Classi utility in index.css + modifiche dirette ai componenti layout |
| Dark mode | Le variabili CSS dark restano coerenti, i gradient si adattano |

