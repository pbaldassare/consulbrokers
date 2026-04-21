

## Bug: pagine portafoglio vuote (Carico, Storico, Attive)

### Causa
La migration `20260421165120` ha ricreato `v_portafoglio_titoli` aggiungendo `fine_periodo_effettivo / prossima_garanzia_da/a / mese_carico / premi_modificabili`, ma ha **rimosso** colonne usate dal frontend:
- `ramo_nome` (ora c'è solo `ramo_descrizione`)
- `cliente_codice`
- `cliente_cognome`, `cliente_nome`, `cliente_ragione_sociale`
- `nome_ufficio`

Le pagine `PortafoglioCaricoPage`, `PortafoglioStoricoPage`, `PortafoglioAttivePage` chiedono `ramo_nome, cliente_codice` → PostgREST risponde errore → tabelle vuote ("0 polizze in scadenza").

### Conferma dal DB
- 13 titoli con `mese_carico='2026-04'` esistono e sono corretti (es. `d046ffeb…`, allineamento `garanzia_a=2026-04-04` riuscito ✅)
- 15 titoli con `data_scadenza` ad aprile 2026
- La pagina ne mostra 0 → errore di selezione PostgREST, non di filtro

### Fix

**1. Migration di ripristino vista**
Ricreo `v_portafoglio_titoli` mantenendo TUTTE le colonne nuove (rinnovo + lock premi + alias `fine_periodo_effettivo`) E aggiungendo le colonne mancanti:
- `r.descrizione AS ramo_nome` (oltre a `ramo_descrizione` per compatibilità)
- `cl.codice_ricerca AS cliente_codice`
- `cl.cognome AS cliente_cognome`, `cl.nome AS cliente_nome`, `cl.ragione_sociale AS cliente_ragione_sociale`
- `u.nome_ufficio`

**2. Cambio concettuale del filtro Carico (allineato al piano "Renewal Concept")**
In `PortafoglioCaricoPage.tsx`:
- **Vecchio filtro**: `data_scadenza ∈ [start, end]`
- **Nuovo filtro**: `mese_carico = 'YYYY-MM'` (= il mese in cui parte il nuovo periodo di copertura)

Applicato sia alla query principale che alla query del totale premio. Coerente con il banner esplicativo già presente in pagina.

**3. Nessun cambio frontend per Storico/Attive**
Una volta ripristinate le colonne mancanti nella vista, queste due pagine torneranno a funzionare senza modifiche.

### Verifica attesa
1. `/portafoglio/carico` ad Aprile 2026 → mostra 13 titoli (tutti con `mese_carico=2026-04`)
2. Polizza `RCM00010074404` (trimestrale, `data_scadenza=2027-01-19` ma `garanzia_a=2026-04-19`) appare in **Aprile 2026** (non più in Gennaio 2027) — questo è il vero comportamento corretto del nuovo concetto di rinnovo
3. `/portafoglio/storico` e `/portafoglio/attive` tornano a funzionare
4. Tutte le colonne UI (Ramo, Codice cliente) restano popolate

### File toccati
- `supabase/migrations/<new>.sql` — ricreazione vista con colonne legacy + nuove
- `src/pages/PortafoglioCaricoPage.tsx` — filtro `mese_carico` invece di `data_scadenza`

### Cosa NON faccio
- Non tocco `PortafoglioStoricoPage.tsx` né `PortafoglioAttivePage.tsx` (basta il fix vista)
- Non tocco trigger `align_garanzia_a` né `lock_premi_storici` (funzionano)
- Non tocco la regola legacy aprile 2026 né `in_attesa_rinnovo`

