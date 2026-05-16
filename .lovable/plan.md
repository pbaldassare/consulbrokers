## Problema

Il CF `BLDPLA74R211449G` viene rifiutato da `src/lib/validateCF.ts`. Analizzando la stringa con il formato standard italiano (`LLLLLL NN L NN L NNN L`), risulta che:

- posizioni 0–10 sono coerenti (`BLDPLA 74 R 21`)
- posizione 11 dovrebbe essere una **lettera** (sigla provincia) ma è la cifra `1`
- posizioni 12–14 sono `449` (corretto come cifre)
- check `G` non torna con il calcolo standard

Due cose vere allo stesso tempo:

1. **Bug reale del validatore**: `validateCF.ts` usa una regex strict (`/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/`) e **non gestisce l'omocodia**, cioè la sostituzione lettere↔cifre che l'Agenzia delle Entrate applica in caso di collisione. Molti CF reali emessi per omocodia (con lettere nelle posizioni "cifra" 6,7,9,10,12,13,14,15) oggi vengono rifiutati erroneamente.
2. **CF in questione**: il valore digitato ha però una cifra alla posizione 11 (provincia), che è una posizione **non** soggetta a omocodia secondo le regole AdE. Sospetto trascrizione: probabilmente al posto del `1` a pos. 11 (o 12) c'è una `I` (lettera I), oppure la stringa contiene un OCR mismatch fra `1` e `I`/`L`.

## Cosa fare

### 1. Estendere `src/lib/validateCF.ts` con il supporto omocodia

- Allargare la regex per accettare nelle posizioni "cifra" (indici 6,7,9,10,12,13,14,15) anche le lettere ammesse dalla tabella di sostituzione AdE: `L,M,N,P,Q,R,S,T,U,V` ↔ `0..9`.
- Mantenere la regex strict invariata sulle altre posizioni (0–5, 8, 11) — dove l'omocodia non si applica.
- Calcolare il checksum **sul CF così come scritto** (omocodico), come prevede la specifica AdE. La versione "non omocodica" si ottiene solo per ottenere dati anagrafici, non per la verifica del check.
- Aggiungere flag `isOmocodia` al risultato per uso futuro (es. badge in UI).
- Aggiornare i test esistenti in `src/lib/__tests__/validateFiscal.test.ts` con almeno: un caso standard, un caso omocodia singolo, un caso multiplo, un caso non valido.

### 2. Migliorare il messaggio d'errore in `FiscalCodeInput`

Oggi mostra solo "Formato Codice Fiscale non valido" / "carattere di controllo errato". Aggiungere indicazione della posizione del primo carattere sospetto (es. _"Carattere non atteso in posizione 12 (atteso: cifra)"_) per aiutare a riconoscere errori di battitura tipo `1`↔`I`, `0`↔`O`.

### 3. Verifica del CF utente

Dopo il fix, `BLDPLA74R211449G` resterà comunque rifiutato perché la cifra a pos. 11 non è ammessa nemmeno in omocodia. Il messaggio migliorato indicherà quale carattere correggere. Se l'utente conferma il valore esatto, gli proporremo di ricontrollare la fonte (probabile `I` letta come `1`).

## Note tecniche

- File toccati: `src/lib/validateCF.ts`, `src/lib/__tests__/validateFiscal.test.ts`, `src/components/ui/FiscalCodeInput.tsx`.
- Nessuna modifica DB / RLS / Edge Function.
- Comportamento sync 11 cifre → P.IVA (Core memory) **invariato**.

## Fuori scopo

- Persistenza del flag omocodia in DB.
- Validazione cross-field CF↔anagrafica (sesso, data nascita, comune) — già coperta altrove.
