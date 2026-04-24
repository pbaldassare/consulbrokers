

## Inglobare Settori RCA nei Rami + semplificare Usi RCA

### Decisioni dell'utente
1. I 16 settori RCA (Autovetture, Autotassametri, Autocarri, Moto, Natanti, Camper…) diventano **nuovi rami** sotto il gruppo `ZQ - R.C.A.` → la tabella `rami` passerà da 182 a **198 record**.
2. La tabella `rca_usi` (43 record) **resta**, ma viene semplificata: il dropdown "Uso" nel form RCA diventa una **lista piatta** non più dipendente dal settore.
3. La tabella `rca_settori` viene **eliminata** dal DB e dalla pagina `/tabelle-base`.

### Stato attuale verificato

- **`rca_settori`** (16 record, codici `01`–`16`): da inglobare in `rami`.
- **`rca_usi`** (43 record con FK `settore_id → rca_settori.id`): la FK va rimossa per consentire la cancellazione di `rca_settori`. La tabella resta come lista piatta.
- **`rami`**: ha già 28 voci sotto gruppo `ZQ - R.C.A.` (R.C.AUTO, KASKO, ARD, INC/FURTO…). Aggiungeremo 16 nuove voci per i tipi veicolo.
- **`titoli`** salva `settore` e `uso` come **campi text liberi** (non FK) → nessuna migrazione dati storici necessaria, gli storici restano leggibili.
- **File toccati**:
  - `src/hooks/useRcaLookups.ts` — `useRcaSettori` (da rimuovere/sostituire) e `useRcaUsi` (da semplificare).
  - `src/pages/ImmissionePolizzaPage.tsx` (righe 24, 127–128, 1065–1076) — il form RCA usa entrambi gli hook.
  - `src/pages/TabelleBasePage.tsx` (righe 577, 585–618, 665–666, 1000–1068) — entry "Settori RCA" e gestione custom "Usi RCA".

### Soluzione proposta

#### 1. Migrazione DB

**a)** Pre-creare i 16 nuovi rami sotto il gruppo `ZQ - R.C.A.`. Per evitare collisioni con codici esistenti (es. `QC` = "R.C. AUTOCARRI"), uso il **prefisso `RV`** (Ramo Veicolo) + codice numerico originale del settore:

```sql
INSERT INTO rami (codice, descrizione, gruppo_ramo_id, attivo)
SELECT 
  'RV' || s.codice,                                  -- RV01, RV02, …, RV16
  'VEICOLO - ' || UPPER(s.descrizione),              -- "VEICOLO - AUTOVETTURE", …
  (SELECT id FROM gruppi_ramo WHERE codice = 'ZQ'),  -- gruppo R.C.A.
  true
FROM rca_settori s
ORDER BY s.codice
ON CONFLICT (codice) DO NOTHING;
```

Il prefisso `VEICOLO -` nella descrizione li rende immediatamente riconoscibili nell'elenco rami (così non si confondono con le coperture come "R.C. AUTOVEICOLI" già esistente).

**b)** Rimuovere la FK su `rca_usi.settore_id` e poi eliminare `rca_settori`:

```sql
ALTER TABLE rca_usi DROP COLUMN settore_id;
DROP TABLE rca_settori;
```

Risultato finale:
- `rami`: 198 record (di cui 44 sotto gruppo R.C.A.: 28 esistenti + 16 nuovi).
- `rca_usi`: 43 record, lista piatta.
- `rca_settori`: tabella **non esiste più**.

#### 2. UI — `src/hooks/useRcaLookups.ts`

- **Rimuovo** `useRcaSettori` (non serve più — i tipi veicolo si scelgono ora come ramo o tramite il select "Tipo Veicolo" già esistente).
- **Semplifico** `useRcaUsi`: rimuovo il parametro `settoreId`, restituisco la lista piatta di tutti gli usi attivi ordinata per codice.

```ts
export function useRcaUsi() {
  return useQuery({
    queryKey: ["rca-usi"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rca_usi" as any)
        .select("id, codice, descrizione")
        .eq("attivo", true)
        .order("codice");
      return (data || []).map((r: any) => ({
        value: r.descrizione,
        label: `${r.codice} - ${r.descrizione}`,
      }));
    },
    staleTime: 1000 * 60 * 30,
  });
}
```

#### 3. UI — `src/pages/ImmissionePolizzaPage.tsx`

- Rimuovo l'import `useRcaSettori` e lo stato `vSettoreId` + `setVSettoreId`.
- Rimuovo il `SearchableSelect` "Settore" (righe 1064–1067).
- Mantengo il `SearchableSelect` "Uso" ma senza `disabled={!vSettoreId}` (ora sempre abilitato, lista piatta).
- Il salvataggio su `titoli.settore` resta valorizzato dal `vSettore` derivato dal **Tipo Veicolo** già esistente nel form (è un altro select che già copre questa info).

#### 4. UI — `src/pages/TabelleBasePage.tsx`

- Rimuovo la riga 1000 (`{ value: "rca_settori", … }`) dalla lista delle tabelle base.
- Rimuovo la logica `custom === "rca_usi"` (righe 577, 585–618, 665–666, 1068) che fa il join con `rca_settori`. La tab "Usi RCA" diventa un CRUD standard senza riferimento al settore (uso lo stesso pattern delle altre tabelle base semplici come "Zone" o "Indotti").

#### 5. Aggiornamento `src/lib/rcaConstants.ts`

Il file ha `TIPI_VEICOLO` hardcoded (15 voci). Resta inalterato — è la fonte alternativa già usata in altri punti per il tipo veicolo. I 16 nuovi rami `RV01…RV16` sono un'opzione **aggiuntiva** disponibile come ramo della polizza.

### File modificati

1. **Migrazione SQL** (singola): INSERT 16 rami + DROP COLUMN `rca_usi.settore_id` + DROP TABLE `rca_settori`.
2. **`src/hooks/useRcaLookups.ts`**: rimuovo `useRcaSettori`, semplifico `useRcaUsi` (no parametro).
3. **`src/pages/ImmissionePolizzaPage.tsx`**: rimuovo dropdown Settore e relativi stati; "Uso" sempre abilitato.
4. **`src/pages/TabelleBasePage.tsx`**: rimuovo entry "Settori RCA" e la logica custom join per "Usi RCA".

### Cosa NON tocco

- ❌ `titoli.settore` / `titoli.uso` (campi text) — i valori storici restano leggibili, nessuna migrazione dati.
- ❌ `src/lib/rcaConstants.ts` — la lista `TIPI_VEICOLO` hardcoded resta come riferimento alternativo.
- ❌ I 28 rami già esistenti sotto gruppo `R.C.A.` (KASKO, ARD, ecc.) — restano come sono.
- ❌ Nessuna logica polizze/sinistri/provvigioni cambia.

### Verifica

1. **DB**: `SELECT COUNT(*) FROM rami` → **198**; `SELECT COUNT(*) FROM rami WHERE codice LIKE 'RV%'` → **16**.
2. **DB**: `SELECT to_regclass('public.rca_settori')` → **NULL** (tabella eliminata).
3. **DB**: `SELECT COUNT(*) FROM rca_usi` → **43** (intatti); colonna `settore_id` non esiste più.
4. **UI `/tabelle-base`**: tab "Settori RCA" sparita; tab "Usi RCA" funziona come CRUD semplice (codice + descrizione + attivo, senza colonna settore).
5. **UI `/rami` o tab Rami**: filtrando per gruppo "R.C.A." vedo 44 voci (28 esistenti + 16 nuove `VEICOLO - …`).
6. **UI ImmissionePolizza** (sezione RCA): non c'è più il select "Settore"; il select "Uso" mostra tutti i 43 valori senza filtro per settore.
7. **Polizze esistenti**: aprire una polizza RCA storica → i campi `settore` e `uso` salvati come testo si vedono ancora correttamente.

