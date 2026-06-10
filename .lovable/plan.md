
## Obiettivo
Sostituire/aggiungere il nuovo logo `logo CBNET (1).svg` in 4 punti dell'app.

## Passi

**1. Upload del logo come asset CDN**
- Caricare `user-uploads://logo_CBNET_1.svg` via `lovable-assets` → genera `src/assets/logo-cbnet.svg.asset.json`.
- Generare anche due varianti PNG (192x192 e 512x512) per favicon/PWA partendo dall'SVG.

**2. Pagina di Login (`src/pages/LoginPage.tsx`)**
- Sostituire l'attuale riquadro con icona lucchetto + scritta "CBnet" / "Gestionale" con il logo SVG centrato (altezza ~56-64px).
- Mantenere il sottotitolo "Accedi" / "Recupera Password" e il form invariati.

**3. Sidebar (`src/components/AppSidebar.tsx`)**
- Nell'header della sidebar (sopra la nav), mostrare il logo SVG.
- Versione compatta quando `collapsed === true`: solo monogramma/icona ridotta o logo scalato.

**4. Favicon / Apple touch icon (`index.html` + `public/manifest.json`)**
- Sostituire `/icon-192.png` e `/icon-512.png` con le versioni generate dal nuovo logo.
- Aggiornare `<link rel="icon">` e `apple-touch-icon` in `index.html` (se serve nuova chiave).
- Aggiornare `manifest.json` se referenzia le icone.

**5. Email branding (`email_branding` table)**
- Aggiornare il record esistente in `email_branding` settando `logo_url` = URL CDN del nuovo logo SVG.
- Non tocchiamo la UI di `EmailBrandingTab` (l'utente potrà comunque cambiarlo da lì in futuro).

## Note tecniche
- Lo SVG contiene metadati C2PA (manifest Canva) molto pesanti: valutiamo se ripulirli prima dell'upload per ridurre il peso (opzionale, non bloccante).
- Il colore primario teal/dark petrol resta invariato — il logo si presume leggibile su sfondo chiaro (Login card, Sidebar header con gradient scuro: verifico contrasto e, se necessario, applico un wrapper con bg chiaro o uso una versione monocromatica).

## Domanda residua (sblocco rapido in build)
Il logo va bene su entrambi gli sfondi (Login bianco + Sidebar gradient scuro)? Se no, mi servirà anche una versione "white/inverted" — altrimenti applico un piccolo background pill chiaro al logo in sidebar.
