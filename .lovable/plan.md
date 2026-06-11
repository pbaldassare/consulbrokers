## Causa

L'upload fallisce con `Invalid key: titolo/.../1781174542770_Ars Restauri - …` (visibile nel toast). Supabase Storage rifiuta chiavi con spazi o caratteri non-ASCII (`ò`). Il file si chiama `Ars Restauri - Groupama - Doblò FW786JT.pdf`.

## Fix

1. Nuovo helper `src/lib/sanitizeFileName.ts`:
   - rimuove diacritici (NFD), sostituisce spazi/simboli con `_`.
2. In `src/components/DocumentiTab.tsx` (riga 110) e `src/pages/cliente/ClienteUploadDoc.tsx` (riga 50):
   - uso `sanitizeStorageFileName(file.name)` solo per costruire la `path` storage.
   - il campo DB `documenti.nome_file` resta `file.name` originale (così l'utente vede sempre il nome leggibile con accenti).

Nessun impatto sui documenti già caricati.