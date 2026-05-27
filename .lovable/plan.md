Rimuovere il blocco `<AiDocumentScanner ... />` dentro la card "Contratto" di `src/pages/ImmissionePolizzaPage.tsx` (linee 1529-1541): è un doppione del bottone "Importa da PDF (AI)" già presente in cima alla pagina.

Cleanup correlato:
- Rimuovere gli import non più usati: `AiDocumentScanner` e il tipo `DocumentType`.
- Rimuovere `scannedFileRef` (`useRef<File | null>`) se non referenziato altrove.
- Bump `public/version.json`.