## Obiettivo
Avere un campo **Ritenuta d'acconto %** valorizzato di default a **4,60%** su tutte le entità che percepiscono provvigioni (agenzie, rapporti compagnia, produttori, corrispondenti, account executive) e usarlo nei calcoli/visualizzazioni già esistenti.

## Stato attuale
- `anagrafiche_professionali.percentuale_ra` **esiste già** (numeric, nullable, default NULL) ed è usato in `ECProduttoriContabPage` e `ec-produttore-pdf.ts`.
- `compagnie` e `compagnia_rapporti` **non hanno** alcun campo ritenuta — in `ec-agenzia-pdf.ts` la ritenuta è oggi calcolata con un valore hard-coded.

## Modifiche

### 1. Migration DB
- `ALTER TABLE compagnie ADD COLUMN ritenuta_acconto numeric(5,2) NOT NULL DEFAULT 4.60;`
- `ALTER TABLE compagnia_rapporti ADD COLUMN ritenuta_acconto numeric(5,2) DEFAULT 4.60;` (nullable → fallback sulla compagnia madre se NULL).
- `ALTER TABLE anagrafiche_professionali ALTER COLUMN percentuale_ra SET DEFAULT 4.60;`
- Backfill: `UPDATE anagrafiche_professionali SET percentuale_ra = 4.60 WHERE percentuale_ra IS NULL;`
- Backfill `compagnie`/`compagnia_rapporti` già coperto dal DEFAULT su righe nuove; le righe esistenti ereditano 4.60 dalla DEFAULT della ALTER.

### 2. UI — aggiunta campo "Ritenuta d'acconto %" (input numerico, suffisso "%", default 4,60)
- `src/pages/AnagraficheCompagniePage.tsx` — form Compagnia, nella sezione fiscale/bancaria.
- `src/components/compagnie/RapportiCompagniaDialog.tsx` — form Rapporto (riga dopo "% provvigione"); placeholder "eredita da compagnia (4,60)".
- `src/pages/AnagraficheInternePage.tsx` — form Anagrafica professionale (produttori, corrispondenti, account executive): il campo `percentuale_ra` viene reso visibile/valorizzato a 4,60 di default in creazione e mostrato per tutti i tipi (oggi è mostrato solo per alcuni).

### 3. Applicazione nei calcoli
- `src/lib/ec-agenzia-pdf.ts` e `src/pages/contabilita/ECAgenziaPdfPage.tsx`: usare `compagnia_rapporto.ritenuta_acconto ?? compagnia.ritenuta_acconto ?? 4.60` al posto del valore hard-coded.
- `src/lib/ec-produttore-pdf.ts` / `ECProduttoriContabPage.tsx`: continuano a usare `percentuale_ra` (con fallback 4,60 se null — sicurezza in più).
- Eventuali altri punti che oggi assumono una ritenuta fissa per agenzie restano invariati (fuori scope per ora).

### 4. Memoria
Aggiungere `mem://accounting/ritenuta-acconto-default.md`: "Ritenuta d'acconto di default 4,60% su compagnie, compagnia_rapporti (fallback su compagnia), anagrafiche_professionali (tutti i tipi). Sempre editabile per riga."

## Fuori scope
- Non si modifica la logica di calcolo provvigioni in `resolveProvvigione` né i pagamenti provvigioni (non richiesto).
- Nessuna modifica a clienti / prospect / profiles.
