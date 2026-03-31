

## Piano: Import Portafoglio Polizze — Schema + Edge Function + Esecuzione

### Panoramica

1803 record da importare. Serve prima aggiornare lo schema DB (nuovi campi e tabelle di lookup), poi creare una Edge Function `import-portafoglio`, infine eseguire l'import.

---

### Step 1 — Migrazione DB: nuove tabelle di lookup

Creare 3 nuove tabelle di lookup (struttura standard: `id, codice, descrizione, attivo, created_at`):

| Tabella | Dati iniziali (dall'Excel) |
|---|---|
| `lookup_risk_type` | Valori unici trovati nell'Excel (quasi tutti vuoti) |
| `lookup_tipo_documento` | PI, PQ, AM (+ quelli che aggiungerai tu) |
| `lookup_conti_incasso` | "CASSA NAPOLI", "BANCA PREALPI G 10756", "BNL C/C 941", ecc. |

**Nota**: `tipi_mandatario` esiste già nel DB e in TabelleBasePage — non serve crearla.

### Step 2 — Migrazione DB: nuovi campi su `titoli`

| Campo | Tipo | Note |
|---|---|---|
| `percentuale_riparto` | numeric | %Riparto (es. 100) |
| `tipo_mandatario` | text | FK logica → `tipi_mandatario.codice` |
| `risk_type` | text | FK logica → `lookup_risk_type.codice` |
| `prodotto_nome` | text | Nome prodotto dal legacy |
| `comp_contabile` | date | Data competenza contabile |
| `comp_assicurativa` | date | Data competenza assicurativa |
| `tipo_incasso` | text | B, X, P ecc. |
| `conto_incasso` | text | Nome conto |
| `id_legacy` | integer | ID sistema vecchio per tracciabilità |
| `produttore_nome` | text | Nome produttore (testo, no FK) |
| `ae_nome` | text | Nome Account Executive (testo) |
| `filiale` | text | Codice filiale (NA, FIB, PZZ) |

### Step 3 — Migrazione DB: nuovi campi su `movimenti_polizza`

| Campo | Tipo | Note |
|---|---|---|
| `tipo_documento` | text | PI, PQ, AM |
| `premio_netto` | numeric | Imponibile |
| `tasse` | numeric | |
| `provvigioni_attive` | numeric | |
| `provvigioni_passive` | numeric | |
| `stato_incasso` | text | S, altro |

### Step 4 — Aggiornare TabelleBasePage

Aggiungere i 3 nuovi tab in `tabConfig`:
- `lookup_risk_type` → "Risk Type"
- `lookup_tipo_documento` → "Tipo Documento"
- `lookup_conti_incasso` → "Conti Incasso"

### Step 5 — Edge Function `import-portafoglio`

Logica:
1. Riceve array di record parsati dal client
2. Per ogni `numero_titolo` unico: crea/aggiorna un record in `titoli` (usa i dati della riga PI o della più recente)
3. Per ogni riga Excel: crea un record in `movimenti_polizza`
4. Lookup automatici:
   - `clienti.codice_ricerca` → `cliente_anagrafica_id`
   - `compagnie.codice` → `compagnia_id`
   - `rami.codice` → `ramo_id`
   - `uffici` per filiale → `ufficio_id`
5. Produttore e AE salvati come testo (no FK)
6. Action `replace_all`: cancella tutti i titoli e movimenti esistenti, poi inserisce

### Step 6 — Esecuzione import

- Parsare `portafoglio_napoli_dal_2020_3.xlsx` via script
- Preparare payload JSON
- Invocare Edge Function con `action: "replace_all"`
- Risultato atteso: ~titoli unici creati + 1803 movimenti

### Step 7 — `clienti.fatturato`

Il campo `fatturato` esiste già in `clienti`. I dati "Fatt" dell'Excel sono ridondanti (sono dati del cliente, non della polizza). Non serve un nuovo campo.

---

### Dettagli tecnici

**File coinvolti:**

| File | Modifica |
|---|---|
| Migrazione SQL | 3 tabelle lookup + campi su `titoli` e `movimenti_polizza` |
| `src/pages/TabelleBasePage.tsx` | 3 nuovi tab |
| `supabase/functions/import-portafoglio/index.ts` | Nuova Edge Function |
| `supabase/config.toml` | Aggiungere `[functions.import-portafoglio]` |
| Script esecuzione | Parsing Excel + invocazione |

