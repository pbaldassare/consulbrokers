

## Piano: Miniature documenti + Conferma eliminazione

### 1. Miniature per ogni documento

Nel componente `DocumentiTab.tsx`, per ogni documento nella tabella:
- **Immagini** (jpg, png, webp): generare un URL firmato via `supabase.storage.from(bucket).createSignedUrl(path, 3600)` e mostrare un `<img>` come miniatura (48x48px, object-cover, rounded)
- **PDF**: mostrare un'icona PDF stilizzata (già presente `FileText`, la sostituiamo con un'icona più specifica rossa per i PDF)
- **Altri file**: mantenere l'icona `FileText` generica

La miniatura sostituirà l'icona `FileText` nella prima colonna della tabella. Si userà un hook `useEffect` o un approccio inline per ottenere le signed URLs per i file immagine.

Implementazione:
- Creare un sotto-componente `DocumentThumbnail` interno al file che riceve `bucket_name`, `path_storage` e `nome_file`
- Controlla l'estensione: se immagine → fetch signed URL e mostra `<img>`, se PDF → icona PDF rossa, altrimenti → icona generica
- Dimensione miniatura: 40x40px con bordo arrotondato

### 2. Dialog di conferma per l'eliminazione

Aggiungere un `AlertDialog` (già disponibile in `src/components/ui/alert-dialog.tsx`) che si apre quando si clicca il pulsante cestino:
- Stato `deleteTarget` per tracciare quale documento eliminare
- Al click su Trash2 → apri dialog con messaggio "Sei sicuro di voler eliminare questo documento? L'azione è irreversibile."
- Pulsante "Elimina" (destructive) → esegue `handleDelete`
- Pulsante "Annulla" → chiude il dialog

### File coinvolti

| Azione | File |
|--------|------|
| Modificare | `src/components/DocumentiTab.tsx` — aggiungere miniature + AlertDialog conferma eliminazione |

