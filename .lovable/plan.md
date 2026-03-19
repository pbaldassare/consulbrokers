

## Piano: Fix miniature documenti + Anteprima click

### Problema
Le miniature non si caricano perché `createSignedUrl` potrebbe non funzionare correttamente con i bucket privati e le policy RLS. Inoltre manca la possibilità di aprire un'anteprima cliccando sulla miniatura.

### Soluzione

**1. Fix caricamento miniature** in `DocumentiTab.tsx`:
- Sostituire `createSignedUrl` con `download` + `URL.createObjectURL` per generare le URL delle miniature (stesso metodo che funziona già per il download)
- Questo funziona indipendentemente dalle policy RLS del bucket

**2. Aggiungere anteprima full-size al click**:
- Aggiungere un `Dialog` che si apre al click sulla miniatura o sul nome file
- Per le immagini: mostrare l'immagine a dimensione piena
- Per i PDF: mostrare il PDF in un `<iframe>` o aprirlo in una nuova tab
- Per altri file: avviare il download diretto
- Aggiungere un pulsante `Eye` (già importato ma non usato) come azione rapida

**3. Generare miniatura anche per i PDF**:
- Usare la prima pagina del PDF come anteprima tramite un canvas e `pdfjs` sarebbe troppo pesante
- Alternativa pratica: mostrare un'icona PDF colorata ma al click aprire il PDF in un dialog con iframe

### Dettagli tecnici

- `DocumentThumbnail`: useEffect con `supabase.storage.from(bucket).download(path)` → `URL.createObjectURL(blob)` per generare URL blob locale
- Cleanup: `URL.revokeObjectURL` nel return dell'useEffect
- Dialog anteprima: stato `previewDoc` per tracciare il documento selezionato, signed URL generata al momento dell'apertura
- Il cursore sulla miniatura diventa pointer per indicare che è cliccabile

### File coinvolti

| Azione | File |
|--------|------|
| Modificare | `src/components/DocumentiTab.tsx` — fix thumbnail + aggiunta anteprima |

