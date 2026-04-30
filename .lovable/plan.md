# Fix anteprima PDF bloccata da Chrome

## Problema
Chrome blocca il rendering del blob PDF dentro `<iframe>` ("Questa pagina è stata bloccata da Chrome"), quindi l'anteprima resta vuota.

## Soluzione
Sostituire l'iframe con un componente che renderizza le pagine PDF su `<canvas>` usando **`pdfjs-dist`** (già installato ora). Questo bypassa la restrizione di Chrome sugli embed PDF e funziona in modo identico tra browser.

## Modifiche

### 1. Nuovo file `src/components/PdfPreview.tsx`
- Riceve `data: Uint8Array | null`
- Usa `pdfjs.getDocument({ data })` per caricare il PDF
- Per ogni pagina crea un `<canvas>` e chiama `page.render(...)` a scala 1.4
- Worker importato come URL: `pdfjs-dist/build/pdf.worker.min.mjs?url`
- Container scrollabile con sfondo grigio chiaro e ombra sui canvas

### 2. `src/pages/DocPrecontrattualePage.tsx`
- Cambiare lo state da `previewUrl: string | null` a `previewBytes: Uint8Array | null`
- `handleAnteprima` chiama direttamente `buildPrecontrattualePdf(...)` e salva i bytes nello state
- Sostituire l'`<iframe>` dentro il `<Dialog>` con `<PdfPreview data={previewBytes} />`
- Rimuovere la `URL.revokeObjectURL` non più necessaria
- I bottoni **Stampa** e **Salva PDF** restano come sono (apertura/download del blob URL funzionano, è solo l'embed in iframe che Chrome blocca)

### 3. `public/version.json` bump

## QA
Generare il PDF in preview, aprire il modale e verificare che le pagine appaiano correttamente nei canvas (no schermata bloccata).
