Hai ragione: dalla tua schermata e dalla verifica risulta che il problema non è solo il login. Il browser sta ancora eseguendo una shell vecchia e nel codice ci sono ancora alcune voci residue che non devono più comparire nel gestionale.

Procedo così:

1. Pulizia definitiva delle voci vecchie nel gestionale
- Rimuovere dalla sidebar ogni voce residua non voluta:
  - `FATTURAPA`
  - `CONT. GENERALE`
  - `Area CFO`
  - `Comunicazioni` come voce di menu vecchia, mantenendo invece `Chat` dove previsto
  - eventuali voci legacy non coerenti con la nuova struttura
- Sistemare anche le route legacy in modo che, se un vecchio link viene aperto, non carichi più la pagina vecchia ma reindirizzi a una pagina valida.
- Ripulire `SitemapPage` e configurazioni correlate per non mostrare più pagine vecchie come disponibili.

2. Correzione vera del problema versione/cache alla login
- Spostare il controllo versione prima del rendering dell’app e non solo dentro login/guard: se il bundle è vecchio, l’app non deve nemmeno montare la UI vecchia.
- Aggiungere una schermata di “aggiornamento applicazione” mentre pulisce cache e service worker, così non resta visibile la vecchia dashboard/sidebar.
- Rendere il check versione più robusto:
  - fetch di `/version.json` con cache busting;
  - confronto con versione bundle;
  - pulizia Cache Storage;
  - unregister di eventuali service worker rimasti;
  - reload controllato senza loop.

3. Kill-switch service worker
- Aggiungere file statici `public/sw.js` e `public/service-worker.js` con logica kill-switch.
- Questo serve per disinstallare service worker già registrati in precedenti versioni: cancellano cache, reclamano i client e si unregisterano.
- Questo è necessario perché cancellare il plugin PWA o fare cleanup da React non basta se un vecchio service worker intercetta la pagina prima che React parta.

4. Manifest/PWA: togliere ciò che favorisce cache/installazioni stale nel gestionale
- Sistemare `manifest.json` per evitare che continui a puntare a start URL vecchi o modalità standalone problematica per il gestionale.
- Mantenere solo ciò che serve senza riattivare PWA/service worker.
- Rimuovere eventuali meta cache-control inutili o fuorvianti da `index.html`, perché in preview/hosting i cache header reali sono gestiti dalla piattaforma.

5. Versione unica e visibile
- Rendere la versione generata coerente fra bundle e `version.json`.
- Aggiungere log diagnostico chiaro in console: bundle, server, match/mismatch.
- Aggiornare `public/version.json` per forzare la nuova revisione.

6. Verifica finale
- Controllare `/`, `/login`, `/fatturapa`, `/cont-generale`, `/area-cfo`.
- Verificare che le voci vecchie non compaiano più.
- Verificare che dopo login venga caricata sempre la shell aggiornata.

File previsti:
- `src/main.tsx`
- `src/lib/versionCheck.ts`
- `src/components/AppVersionGuard.tsx` o sostituzione con bootstrap pre-render
- `src/components/AppSidebar.tsx`
- `src/routes/sistema.tsx`
- `src/routes/portafoglio.tsx` se necessario
- `src/pages/SitemapPage.tsx`
- `public/sw.js`
- `public/service-worker.js`
- `public/manifest.json`
- `public/version.json`
- eventualmente `index.html`

Non tocco dati Supabase e non modifico report/KPI finanziari.