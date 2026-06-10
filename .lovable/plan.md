## Problema
Il logo CBnet attuale (`logo-cbnet.svg`) ha uno sfondo bianco "baked in" nell'SVG: si vede come un rettangolo bianco sia nella sidebar (su gradient scuro) sia nel box del login.

## Soluzione
Generare una versione del logo con sfondo trasparente e sostituirla nei punti d'uso.

### Passi
1. **Genera logo trasparente**: uso `imagegen--edit_image` sul file SVG attuale per produrre `logo-cbnet-transparent.png` (transparent_background=true, prompt "remove white background, keep only the CB hexagon mark and Consulbrokers wordmark").
2. **Carica come asset CDN** via `lovable-assets create` → `src/assets/logo-cbnet-transparent.png.asset.json`.
3. **Aggiorna i 2 punti d'uso** sostituendo l'import:
   - `src/components/AppSidebar.tsx` (header sidebar, sia espanso che collassato)
   - `src/pages/LoginPage.tsx` (header della card di login)
4. **Favicon e email**: lascio invariati (icona PNG già generata e `email_branding` su URL stabile dell'SVG attuale — non hanno il problema dello sfondo perché su sfondo bianco).

### Note
- Non rimuovo il vecchio asset SVG: resta usato per favicon/email.
- Nessuna modifica a logica, solo presentazione/asset.
