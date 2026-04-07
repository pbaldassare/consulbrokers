

## Piano: Persistenza bandi, deduplica e collegamento trattative

### Situazione attuale
- I risultati dei bandi vivono solo nello state React — se ricarichi la pagina, spariscono
- Non esiste una tabella `bandi` nel database
- Le trattative (`trattative`) hanno campi `prospect_id`, `cliente_id`, `ramo_id`, `compagnia_id` ma nessun riferimento a un bando
- Non c'è meccanismo di deduplica: se cerchi due volte, gli stessi bandi appaiono duplicati

### Cosa implementerò

**1. Nuova tabella `bandi_pubblici`**

Migrazione SQL con:
- `id` uuid PK
- `scheda_id` text UNIQUE — chiave naturale da MondoAppalti, usata per la deduplica
- `titolo`, `oggetto` text
- `ente` (stazione appaltante)
- `tipologia` (procedura aperta, manifestazione di interesse, ecc.)
- `importo` numeric
- `scadenza` date
- `cig` text
- `link` text
- `localita`, `regione` text
- `stato` text default 'aperto' (aperto / scaduto / in_valutazione)
- `created_at`, `updated_at` timestamp
- RLS: lettura per tutti gli autenticati, scrittura solo admin/ufficio

**2. Deduplica tramite `scheda_id`**

- Al salvataggio dei risultati, uso `UPSERT` su `scheda_id`: se il bando esiste già, aggiorno solo i campi che possono cambiare (importo, scadenza, stato)
- Il frontend dopo ogni ricerca salva automaticamente i risultati nel DB
- Al caricamento della pagina, i bandi salvati vengono mostrati subito dal DB (non serve ricescare ogni volta)

**3. Tabella ponte `bandi_trattative`**

- `id` uuid PK
- `bando_id` uuid FK → bandi_pubblici
- `trattativa_id` uuid FK → trattative
- `created_at` timestamp
- UNIQUE su (bando_id, trattativa_id) — no duplicati

Questo permette di:
- Collegare un bando a una o più trattative
- Vedere da un bando quante trattative ci sono sopra
- Vedere da una trattativa a quale bando è associata

**4. Tabella `ricerche_bandi` (storico ricerche)**

- `id` uuid PK
- `regioni` text[] — regioni cercate
- `risultati_count` int
- `eseguita_da` uuid FK → profiles
- `eseguita_il` timestamp default now()
- Serve per sapere chi ha cercato cosa e quando, e per evitare ricerche ripetitive

**5. Aggiornamento UI `BandiPubbliciPage.tsx`**

- All'apertura: carica bandi dal DB (query `bandi_pubblici` con filtri regione/importo/stato)
- Dopo ricerca Browser Use: upsert risultati nel DB, poi ricarica dalla tabella
- Pulsante "Collega a trattativa" su ogni bando → apre dialog per selezionare o creare una nuova trattativa
- Badge sul bando se già collegato a una trattativa
- Tab o sezione "Ricerche recenti" per vedere lo storico

**6. Aggiornamento `TrattativeList.tsx`**

- Nella card trattativa, mostrare il bando collegato (se esiste) con link diretto
- Nel form di creazione trattativa, campo opzionale "Bando di riferimento" con autocomplete

### File coinvolti

| File | Azione |
|------|--------|
| Nuova migrazione SQL | Crea `bandi_pubblici`, `bandi_trattative`, `ricerche_bandi` |
| `src/pages/BandiPubbliciPage.tsx` | Load da DB, upsert dopo ricerca, bottone collega trattativa |
| `src/pages/TrattativeList.tsx` | Mostra bando collegato, campo bando nel form |
| `src/integrations/supabase/types.ts` | Auto-rigenerato dopo migrazione |

### Dettagli tecnici

- Deduplica: `INSERT INTO bandi_pubblici (...) ON CONFLICT (scheda_id) DO UPDATE SET importo=EXCLUDED.importo, scadenza=EXCLUDED.scadenza, updated_at=now()`
- Lo stato "scaduto" viene calcolato confrontando `scadenza < CURRENT_DATE`
- RLS: select per tutti gli authenticated, insert/update per admin e ufficio
- Nessuna modifica alla Edge Function — il salvataggio avviene lato frontend dopo aver ricevuto i risultati

