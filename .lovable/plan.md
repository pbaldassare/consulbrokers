
L'utente vuole eliminare tutti i record fake/demo dalle Anagrafiche Professionali per le categorie: **Liquidatori, Periti, Legali**.

Dallo screenshot vedo codici tipo `DEMO-PRO-011-2877`, `DEMO-PRO-001-8718`, ecc. — tutti con prefisso `DEMO-`.

## Piano: Eliminare anagrafiche fake (Liquidatori, Periti, Legali)

### Cosa farò
1. **Verifica preliminare** (SELECT) sulla tabella `anagrafiche_professionali` per contare quanti record fake ci sono per ciascun tipo:
   - `tipo = 'liquidatore'`
   - `tipo = 'perito'`
   - `tipo = 'legale'`
   
   Filtrando per `codice ILIKE 'DEMO-%'` (oppure tutti i record di questi tipi se sono al 100% fake come dichiarato).

2. **Gestione FK**: prima della DELETE, azzerare eventuali riferimenti in tabelle collegate (es. `sinistri.liquidatore_id`, `sinistri.perito_id`, `sinistri.legale_id` se esistono) per evitare violazioni di vincolo.

3. **Migrazione SQL** per cancellare i record:
   ```sql
   DELETE FROM anagrafiche_professionali
   WHERE tipo IN ('liquidatore','perito','legale')
     AND codice ILIKE 'DEMO-%';
   ```

4. **Verifica finale** (SELECT) per confermare 0 record fake residui nelle tre categorie.

### Domanda di conferma
Prima di procedere voglio confermare con te:
- **Tutti** i Liquidatori/Periti/Legali sono fake → cancello l'intera categoria?
- Oppure solo quelli con codice `DEMO-*` → cancello solo quelli?

(Dallo screenshot tutti i 36 risultati Liquidatori hanno prefisso DEMO, quindi probabilmente sono al 100% fake — ma confermo prima di toccare il DB.)

### File coinvolti
- Una nuova migrazione SQL (nessuna modifica frontend)
