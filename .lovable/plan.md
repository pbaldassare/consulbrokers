
## Obiettivo
Dal file `4464.xlsx` (357 movimenti bancari in entrata, colonna `Descrizione` con causale del bonifico) estrarre solo le righe il cui **ordinante** corrisponde a un **cliente esistente** nella tabella `clienti` del database, e consegnare un foglio Excel con il risultato.

## Approccio

1. **Parsing del file**
   - Leggere il foglio `4464` (357 righe, colonne: Data contabile, Data valuta, Importo, Descrizione).
   - Estrarre il nome dell'ordinante dalla `Descrizione` con regex sul pattern `... a vs favore <NOME> Data Regolamento ...` (vale sia per "Bonifico SEPA istantaneo a vs favore" sia per "BONIFICO A VOSTRO FAVORE").

2. **Caricamento clienti**
   - Query su `clienti` per `id, ragione_sociale, cognome, nome` (tutti i record).

3. **Matching (case-insensitive, accent-insensitive)**
   Normalizzazione applicata a entrambi i lati:
   - upper-case, rimozione accenti
   - rimozione punteggiatura, apostrofi, trattini
   - collasso spazi multipli
   - rimozione suffissi societari (`SRL`, `S.R.L.`, `SPA`, `S.P.A.`, `SAS`, `SNC`, `SOCIETA AGRICOLA`, ecc.)
   - per persone fisiche: confronto sia `COGNOME NOME` sia `NOME COGNOME`

   Tre livelli di match, in ordine di confidenza:
   - **Exact**: stringhe normalizzate uguali
   - **Contains**: il nome cliente normalizzato è contenuto nel payer normalizzato (o viceversa), con lunghezza minima 6 char per evitare falsi positivi
   - **Token overlap ≥ 80%**: per casi tipo `BG.BS CONSULTING SRL` ↔ `BGBS CONSULTING SRL`

4. **Output**
   File `/mnt/documents/4464_matched.xlsx` con due fogli:
   - **Matched**: Data contabile, Data valuta, Importo, Ordinante estratto, Cliente DB (ragione sociale / cognome nome), Cliente ID, Tipo match (exact/contains/token), Descrizione originale
   - **Non_matched**: stesse colonne dei movimenti per cui nessun cliente è stato trovato, così puoi vedere chi manca a sistema

   Più una riga di riepilogo nel chat (totale righe, matched, non matched, importo totale matched).

## Note
- Nessuna modifica al database o al codice del progetto: è solo un'estrazione one-shot.
- 7 righe del file non hanno un ordinante riconoscibile col pattern standard (es. giroconti) → finiranno automaticamente in Non_matched.
- Se preferisci solo match "exact + contains" (più conservativo, meno falsi positivi) o vuoi anche includere il match su `prospect` oltre che `clienti`, dimmelo e adeguo prima di eseguire.
