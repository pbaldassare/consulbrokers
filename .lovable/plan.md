## Problema

L'upload del PDF nel dialog "Import IA tariffario provvigioni" fallisce silenziosamente: la finestra resta su "Salva 0" e la chiamata a `parse-tariffario-rami` termina con `Failed to fetch` (nessun log edge function → la richiesta non arriva mai al runtime). Cause probabili combinate:

1. Body troppo grande passato via `supabase.functions.invoke` (PDF base64 nel JSON).
2. Nessun limite di dimensione lato client → upload PDF di più MB.
3. Gemini via Lovable AI Gateway non sempre legge bene PDF passati come `image_url`/data URL → quando funziona, ritorna 0 righe e l'utente non capisce perché.
4. UI senza feedback: nessun toast/errore visibile, nessun log su console, "Salva 0" indistinguibile da "IA non ha trovato nulla".

## Piano

### 1. Frontend — `AiImportDialog` in `ProvvigioniRapportiTab.tsx`
- Validare il file prima dell'upload: tipo (`pdf`/`image/*`) e dimensione max (es. 8 MB) con toast esplicito.
- Per le immagini, ridimensionare/comprimere in canvas a max 2000px lato lungo + JPEG 0.85 prima del base64, per ridurre il body.
- Per i PDF, mantenere base64 ma rifiutare oltre il limite e suggerire upload come immagine.
- Aggiungere `console.error` dettagliato e toast con il messaggio reale di `error` da `invoke` (oggi viene mostrato solo `e.message` generico).
- Mostrare in UI lo stato: "Caricamento file…" → "Analisi IA…" → numero righe estratte o errore esplicito.
- Se l'IA ritorna 0 righe, mostrare banner "Nessuna riga estratta — verifica leggibilità del documento" invece del solo toast.

### 2. Edge Function `parse-tariffario-rami`
- Aggiungere log di ingresso (size base64, mime, model) e di uscita (n righe, ms).
- Gestire esplicitamente errori del gateway con messaggio user-friendly nel JSON di risposta (evitare `throw` che diventa 500 opaco).
- Rendere il prompt più robusto: chiedere esplicitamente di estrarre tutte le righe anche quando la prima colonna è "Ramo/Sezione" e la % è espressa con virgola (`12,5`).
- Aggiungere fallback: se Gemini non torna `tool_calls`, ritornare `{ righe: [], warning: "..." }` invece di errore, così la UI mostra il banner "no righe".
- Aumentare timeout interno fetch (es. 90s) e leggere lo status anche su errori di rete del gateway.

### 3. Verifica
- Ricaricare lo stesso PDF "ALLEGATO PROVVIGIONALE 05 2021.pdf": verificare che la chiamata arrivi all'edge function (log presenti), che la UI mostri progresso e che restituisca righe o un errore chiaro.
- Caricare un PDF >8 MB: confermare blocco lato client.
- Caricare un'immagine JPG di un tariffario: confermare estrazione righe.

## Note tecniche
- Niente cambi DB.
- Nessun cambio alla logica di salvataggio (`onConfirm` resta invariato).
- Resta tutto dentro `src/components/compagnie/ProvvigioniRapportiTab.tsx` e `supabase/functions/parse-tariffario-rami/index.ts`.
