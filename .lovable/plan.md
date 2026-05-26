# Fix Anteprima E/C Cliente + Dettaglio polizze

## Problema 1 — `Errore: a.toHex is not a function`

**Causa**: `pdfjs-dist@5` (renderer in `PdfPreview.tsx`) **richiede** i file dei 14 font standard (`standardFontDataUrl`) per renderizzare PDF che usano `Helvetica`/`HelveticaBold`/`HelveticaOblique`. `ec-cliente-pdf.ts` usa proprio `StandardFonts.Helvetica*` (non embeddati nel PDF — sono solo referenziati per nome). Senza l'URL dei font standard, pdfjs v5 fallisce nel decoder con quell'errore criptico. Per `ec-agenzia-pdf` non si nota perché probabilmente l'anteprima non veniva mai aperta.

**Fix scelto** (semplice, niente nuove dipendenze):
1. Copiare `node_modules/pdfjs-dist/standard_fonts/` in `public/pdfjs/standard_fonts/` (via uno script `postinstall` in `package.json` + commit dei file in `public/` come fallback immediato per la build attuale).
2. In `src/components/PdfPreview.tsx` passare a `pdfjs.getDocument`:
   ```ts
   pdfjs.getDocument({
     data: bytes,
     standardFontDataUrl: "/pdfjs/standard_fonts/",
     disableFontFace: false,
   })
   ```

In alternativa, se preferito: embeddare un font reale (es. una TTF Inter) nel PDF via `pdf-lib` + `@pdf-lib/fontkit`. Più pesante (+200KB per font, +1 dipendenza), ma elimina del tutto la dipendenza dai font standard di pdfjs. **Proposta**: andiamo con l'opzione (1) — risolve anche eventuali futuri E/C Agenzia / E/C Produttore che usano gli stessi StandardFonts.

## Problema 2 — Dettaglio polizze incluse

Oggi la form mostra solo: `"2 polizze — Totale € 3.365,26"`. Aggiungo, sotto al campo "Polizze incluse", una **tabella riepilogativa** con le righe che finiranno nel PDF:

| N. Titolo | Ramo | Rischio | Compagnia | Effetto | Premio |
|-----------|------|---------|-----------|---------|-------:|

- Stile coerente con le altre tabelle del progetto (zebra, header tinta teal/petrol).
- Sotto la tabella: riga "Totale" allineata a destra.
- Se nessuna polizza presente → riga "Nessuna polizza selezionata".
- Niente nuove query: riuso i `titoli` già caricati da `useQuery(["ec-cli-pdf-titoli", ...])`.

## File toccati

- `public/pdfjs/standard_fonts/*` — copia statica dei font standard pdfjs.
- `src/components/PdfPreview.tsx` — aggiungo `standardFontDataUrl`.
- `src/pages/contabilita/ECClientePdfPage.tsx` — rimpiazzo l'`Input` "Polizze incluse" con una tabella di dettaglio (stessa fonte dati di `buildData().righe`).

## Verifica

1. `/contabilita/ec-cliente/pdf?clienteId=f59cb208-...` → la card "Dati Documento" mostra la tabella con le 2 righe (numero, ramo, rischio "COMUNE DI AGNONE - ...", compagnia, effetto, premio) + totale `€ 3.365,26`.
2. Click **Anteprima** → si apre il dialog e si vede la pagina A4 renderizzata (header CONSULBROKERS, destinatario, intro, tabella, IBAN, footer). Niente errore `a.toHex`.
3. **Stampa** e **Scarica** continuano a funzionare (usano gli stessi bytes, non passano da pdfjs).
