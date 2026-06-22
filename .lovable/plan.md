## Analisi polizza 390721911 (Trotta Bus / Generali Venezia)

Confronto con la nuova logica "rapporto principale automatico per agenzia/direzione".

### Cosa funziona ✅
- **Agenzia "Generali Venezia"** (`compagnie.codice=RER343`, `tipo=agenzia`, `gruppo_compagnia_id` valorizzato): dopo il backfill della migrazione precedente, ha ora **1 solo `compagnia_rapporti` con `is_principale=true`** (`ec437140-86fc-429c-8b10-af368372016d`, nome "Generali Venezia"). ✅
- Le due rate (`377dfa54…` madre + `31c36a64…` rata 2) sono **due record `titoli` indipendenti** come da modello `quietanza-isolation`. ✅
- `sostituisce_polizza='390721911'` (text, numero polizza madre) coerente con l'auto-quietanza. ✅
- Sede Napoli, AE valorizzato, premio_lordo coerente, stato `attivo`. ✅

### Anomalia ❌ — `titoli.compagnia_rapporto_id` non popolato

Entrambe le rate hanno `compagnia_rapporto_id = NULL`. Con la nuova logica ogni titolo su un'**agenzia/direzione** deve puntare al rapporto principale di quella compagnia, altrimenti:
- la risoluzione provvigioni (`provvigioni_compagnia_ramo` → matrice per `compagnia_rapporto_id` + ramo) non trova la riga,
- l'indirizzamento rimesse/E-C agenzia perde il rapporto,
- l'email "messa a cassa" non sa quale referente compagnia usare.

Estensione del problema: **96 titoli totali** hanno `compagnia_rapporto_id=NULL` mentre la loro compagnia (agenzia/direzione) ha già un rapporto principale esistente. Sono tutti titoli inseriti prima del backfill o creati da percorsi che non passano dal trigger.

### Cosa farò

**1) Migrazione DB**

- **Backfill `titoli.compagnia_rapporto_id`**: per ogni titolo con `compagnia_rapporto_id IS NULL` la cui `compagnia` è di tipo `agenzia`/`direzione`, settarlo al `compagnia_rapporti.id` con `is_principale=true` di quella compagnia. Idempotente (`WHERE compagnia_rapporto_id IS NULL`). Stima impatto: 96 righe + relative quietanze figlie già coperte dalla stessa WHERE.

- **Trigger `tg_titoli_set_rapporto_principale`** (BEFORE INSERT OR UPDATE OF `compagnia_id` su `titoli`): se `compagnia_rapporto_id IS NULL` e la `compagnia` è agenzia/direzione, popolarlo col rapporto principale. Così i nuovi titoli non ricreano anomalie.

- **Allineamento con il trigger esistente** `tg_compagnie_auto_rapporto_principale`: nessuna modifica, già hardened.

**2) Verifica post-migrazione**

- Query: zero titoli con `compagnia_rapporto_id IS NULL` per compagnie agenzia/direzione.
- Riaprire la polizza 390721911: entrambe le rate ora con rapporto principale valorizzato; aprire `ProvvigioniCompagniaDialog` su Generali Venezia per verificare che la matrice provvigioni è raggiungibile.

### Cosa NON tocco

- Logica `sostituisce_polizza` (resta `text` = numero polizza, by design).
- Tipologia agenzia/rapporto principale (già a posto).
- Titoli su compagnie di tipo `broker`/`plurimandataria` (modello N:N, scelta esplicita del rapporto via UI).
- Provvigioni, rimesse, quietanze esistenti.
