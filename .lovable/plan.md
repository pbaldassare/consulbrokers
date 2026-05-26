# Anteprima PDF — passare a iframe nativo (drop pdfjs)

## Stato

- **Download PDF**: funziona (file `EC_COMUNE_DI_AGNONE_2026-05-26.pdf` allegato è valido).
- **Anteprima in-dialog**: ancora `a.toHex is not a function` da `pdfjs-dist@5.7` anche dopo aver montato `/pdfjs/standard_fonts/` (regressione nota di pdfjs v5 nel renderer Canvas su PDF generati da `pdf-lib`).

## Decisione

Smettere di usare pdfjs per la preview: il browser ha già un viewer PDF nativo affidabile (Chrome/Edge/Firefox/Safari). Lo usiamo via `<iframe>` su un Blob URL — zero dipendenze, zero workers, zero font esterni, render istantaneo, identico al PDF scaricato.

## Cambiamenti

### `src/components/PdfPreview.tsx` — riscritto in 30 righe
- Niente più `pdfjs-dist`, niente `standardFontDataUrl`, niente canvas loop.
- Riceve `data: Uint8Array | null`.
- In `useEffect`: crea `new Blob([data], { type: "application/pdf" })`, `URL.createObjectURL(blob)`, salva in state.
- Cleanup: `URL.revokeObjectURL(url)` su unmount/cambio dati.
- Render: `<iframe src={url} title="Anteprima PDF" className="w-full h-full border-0" />`.
- Fallback se `data` null: messaggio "Caricamento anteprima…".

### Altri PDF preview
- Verifico che `PdfPreview` sia usato solo dalla pagina E/C cliente (grep): se sì, nessun altro file da toccare. Se è usato anche da `ECAgenziaPdfPage` / `AgenzieInPagamentoPage`, beneficia automaticamente del fix.

### Pulizia (opzionale, non bloccante)
- Posso rimuovere la cartella `public/pdfjs/standard_fonts/` (non più necessaria) e mantenere `pdfjs-dist` solo se è ancora usata altrove (es. `DocumentLibrary`). Verificherò con un grep prima di rimuovere.

## Verifica

1. `/contabilita/ec-cliente/pdf?clienteId=f59cb208-...` → click **Anteprima** → si apre il dialog con il PDF renderizzato dal viewer nativo del browser (toolbar print/download del browser visibile in alto).
2. Stesso flusso su E/C Agenzia / Agenzie in pagamento (se usano `PdfPreview`).
3. **Stampa** e **Scarica**: invariati, già funzionano.
