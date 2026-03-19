

## Piano: Popolare Estrazioni e Stampe con dati e pagine funzionanti

### Situazione attuale
- Le 5 rotte di Estrazioni e Stampe puntano tutte a `PlaceholderPage` (pagine vuote)
- I titoli esistenti hanno `data_incasso`, `importo_incassato` e `produttore_id` tutti NULL
- Non esistono record in `matrice_provvigioni` (zero regole provvigionali)
- Non esistono record in `provvigioni_generate` (zero provvigioni calcolate)
- Serve completare i dati e creare le 5 pagine di estrazione

### Modifiche previste

#### 1. Migration — Completare dati demo e seed provvigioni

**a) Aggiornare i titoli esistenti** con dati mancanti:
- `data_incasso` per i titoli incassati
- `importo_incassato` (uguale o simile a `premio_lordo`)
- `produttore_id` assegnato al profilo "Produttore Consul" (`aed93cfd-...`)

**b) Inserire regole matrice provvigioni** per i prodotti usati:
- Una regola per ruolo "produttore" al 15% per ogni prodotto demo
- Tipo calcolo: percentuale

**c) Inserire provvigioni generate** per ogni titolo incassato:
- Calcolo automatico: `importo_incassato * 15%`
- `user_id` = produttore, `pagata = false`

**d) Inserire altri titoli** per altri clienti privati (Gallo Veronica, Martini Massimo) per avere dati piu ricchi nelle estrazioni

#### 2. Creare 5 pagine di estrazione funzionanti

**a) Portafoglio per Cliente** (`/portafoglio/estrazioni/per-cliente`)
- Query: `titoli` JOIN `clienti` raggruppati per cliente
- Tabella: nome cliente, numero polizze, totale premi, totale incassato
- Filtri: ricerca nome, ufficio
- Esportazione CSV

**b) Portafoglio per Compagnia** (`/portafoglio/estrazioni/per-compagnia`)
- Query: `titoli` JOIN `prodotti` JOIN `compagnie` raggruppati per compagnia
- Tabella: nome compagnia, numero polizze, totale premi, totale incassato
- Filtri: compagnia, ufficio
- Esportazione CSV

**c) Premi e Provvigioni** (`/portafoglio/estrazioni/premi-provvigioni`)
- Query: `titoli` JOIN `provvigioni_generate` JOIN `profiles` (produttore)
- Tabella: numero polizza, cliente, premio lordo, incassato, % provvigione, importo provvigione, produttore
- Filtri: data da/a, produttore, stato pagamento
- Totali in fondo
- Esportazione CSV

**d) Premi Scoperti e Garantiti** (`/portafoglio/estrazioni/premi-scoperti-garantiti`)
- Query: titoli con analisi premi — "scoperto" = titoli creati non ancora incassati, "garantito" = titoli incassati
- Tabella: numero polizza, cliente, compagnia, premio lordo, stato, classificazione
- Filtri: compagnia, stato
- Esportazione CSV

**e) E/C Clienti** (`/portafoglio/estrazioni/ec-clienti`)
- Query: `titoli` raggruppati per cliente con saldo dare/avere
- Tabella: cliente, totale premi, totale incassato, saldo
- Dettaglio espandibile per singolo cliente
- Filtri: ricerca cliente, periodo
- Esportazione CSV

#### 3. Aggiornare App.tsx — Collegare le nuove pagine alle rotte

Sostituire i 5 `PlaceholderPage` con i nuovi componenti.

### File coinvolti

| Azione | File |
|--------|------|
| Migration | Update titoli + seed matrice_provvigioni + seed provvigioni_generate + titoli aggiuntivi |
| Creare | `src/pages/estrazioni/PortafoglioPerClientePage.tsx` |
| Creare | `src/pages/estrazioni/PortafoglioPerCompagniaPage.tsx` |
| Creare | `src/pages/estrazioni/PremiProvvigioniPage.tsx` |
| Creare | `src/pages/estrazioni/PremiScopertiGarantitiPage.tsx` |
| Creare | `src/pages/estrazioni/ECClientiPage.tsx` |
| Modificare | `src/App.tsx` — sostituire PlaceholderPage con nuovi componenti |

### Dettagli tecnici
- Ogni pagina usa `useQuery` con Supabase client per le query
- Esportazione CSV tramite generazione blob lato client
- Filtri con componenti `Select`, `Input`, `DatePicker` gia presenti nel progetto
- Pattern coerente con le altre pagine lista (TitoliList, ClientiList)

