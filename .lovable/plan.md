

## Analisi Progetto: Duplicazioni, Codice Inutilizzato, Semplificazioni

### 1. FILE COMPLETAMENTE INUTILIZZATI (da eliminare)

| File | Motivo |
|------|--------|
| `src/pages/Index.tsx` | Pagina "Welcome to Your Blank App" mai importata/usata |
| `src/App.css` | CSS Vite default, mai importato da nessuno |
| `src/components/ui/use-toast.ts` | Re-export puro di `@/hooks/use-toast` — nessun file lo importa |
| `src/lib/uploadRateLimit.ts` | Funzioni `checkUploadRate` e `getMaxFileSizeMB` mai chiamate da nessuna parte |
| `src/lib/logPerformance.ts` | Funzione `logPerformance` mai importata/usata |

### 2. ROTTE DUPLICATE in App.tsx

| Duplicazione | Dettaglio |
|---|---|
| **BancaImport** montato su 2 rotte | `/banca-import` (riga 232) e `/cont-generale/import-bancario` (riga 217) — stesso componente |
| **DistintaGiornaliera** montata su 2 rotte | `/contabilita/distinta-giornaliera` (riga 198) e `/contabilita/chiusura-giornaliera` (riga 201) — stesso componente |

### 3. DOPPIO SISTEMA DI TOAST

Il progetto usa **due sistemi di notifica in parallelo**:
- **shadcn/ui Toaster** (`@/hooks/use-toast` + `<Toaster />`) — usato in ~20 file
- **Sonner** (`import { toast } from "sonner"`) — usato in ~15 file

Entrambi i `<Toaster>` e `<Sonner>` sono montati in App.tsx. Dovrebbero essere unificati su **uno solo** (Sonner e piu moderno e semplice).

### 4. ICONE LUCIDE INUTILIZZATE in App.tsx

App.tsx importa ~30 icone lucide (righe 102-131) usate solo come prop `icon` delle `PlaceholderPage`. Molte non sono usate altrove: `Landmark`, `Search`, `Shield`, `Percent`, etc. Non e un problema grave ma appesantisce il file.

### 5. SEMPLIFICAZIONI STRUTTURALI PROPOSTE

| Area | Azione |
|---|---|
| **PlaceholderPage proliferazione** | 15+ rotte PlaceholderPage — raggruppare in un array di config e generare le Route via `.map()` per ridurre App.tsx di ~40 righe |
| **App.tsx monolitico** (~280 righe, ~90 import) | Spezzare le rotte in file separati: `routes/archivi.tsx`, `routes/portafoglio.tsx`, `routes/contabilita.tsx`, `routes/sistema.tsx`, `routes/cliente.tsx` |
| **Toast unificazione** | Rimuovere shadcn Toaster, migrare i ~20 file che usano `useToast()` a `toast` di Sonner (API piu semplice: `toast.success("msg")`) |

### Piano di implementazione

1. **Eliminare 5 file inutilizzati** (`Index.tsx`, `App.css`, `ui/use-toast.ts`, `uploadRateLimit.ts`, `logPerformance.ts`)
2. **Rimuovere rotta duplicata** `/banca-import` (tenere solo `/cont-generale/import-bancario`) e `/contabilita/chiusura-giornaliera` (tenere solo `distinta-giornaliera`)
3. **Unificare toast su Sonner**: migrare i ~20 file da `useToast()` a `toast` di Sonner, rimuovere `<Toaster />`, `hooks/use-toast.ts`, `ui/toaster.tsx`, `ui/toast.tsx`
4. **Spezzare App.tsx in route modules**: creare `src/routes/` con file per area funzionale, riducendo App.tsx a ~50 righe
5. **Generare PlaceholderPage via config array** dentro i route module

### Dettagli tecnici

- La migrazione toast e meccanica: `const { toast } = useToast()` + `toast({ title: "X" })` diventa `import { toast } from "sonner"` + `toast.success("X")`
- I route module esportano array di `RouteObject` o elementi JSX da includere nel `<Routes>` principale
- Nessuna modifica funzionale — solo cleanup e riorganizzazione

