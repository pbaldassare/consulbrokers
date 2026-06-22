## Capito — il problema

Per `compagnie.tipo IN ('agenzia','direzione')` la regola è **1:1 con `compagnia_rapporti`** (memoria `rapporto-principale-agenzia-direzione`): il rapporto principale deve essere creato automaticamente al salvataggio della compagnia, copiando nome, codice, IBAN, sede, gruppo, note, conto bancario. Sync bidirezionale è già attivo.

**Stato reale del DB (oggi):**

| Situazione | Conteggio |
|---|---|
| Agenzie/Direzioni con esattamente 1 rapporto principale | 16 ✅ |
| Agenzie/Direzioni con **0 rapporti** (anomalia) | **18 ❌** |
| Agenzie/Direzioni con >1 rapporto | 0 |

Le 18 anomalie (es. `Axa Assiprefin BG0013`, `Axa Mazzoleni BG0012`, `Bene Assicurazioni`, `D.A.S.`, `AIG EUROPE direzione`, `allianz direzione`, `Generali Venezia`, `Groupama Aelle`, `TRB`, `Zurich Giordani`, ecc.) sono state inserite prima/aggirando il trigger `trg_compagnie_auto_rapporto_principale` (creato in maggio 2026 con backfill one-shot). Tutte hanno già `gruppo_compagnia_id` valorizzato, quindi il rapporto si può ricreare deterministicamente dai loro dati.

Inoltre la form "Nuova Agenzia/Direzione" attuale lascia opzionale `gruppo_compagnia_id` (il trigger esce silenziosamente se NULL → rapporto non creato): va reso **obbligatorio** per quei due tipi, così non si rigenerano nuove anomalie.

## Cosa farò

### 1) Migrazione DB
- **Backfill** delle 18 agenzie/direzioni senza rapporto: insert in `compagnia_rapporti` con `is_principale=true`, copiando dalla riga `compagnie` (stessi campi del trigger). Idempotente: solo dove `NOT EXISTS` rapporto.
- **Hardening del trigger** `tg_compagnie_auto_rapporto_principale`: se `gruppo_compagnia_id` è NULL, sollevare `RAISE EXCEPTION` invece di uscire silenziosamente. Così ogni insert futuro fallisce esplicitamente finché il gruppo non è scelto.
- **Vincolo aggiuntivo (soft)**: aggiungere un check via trigger BEFORE INSERT/UPDATE su `compagnie` che, per `tipo IN ('agenzia','direzione')`, esige `gruppo_compagnia_id NOT NULL`.

### 2) UI form Compagnia (`src/components/compagnie/CompagniaForm.tsx` o equivalente, da leggere)
- Quando `tipo` = agenzia/direzione: campo "Gruppo Compagnia" marcato come **obbligatorio** con asterisco e validazione zod; il submit non parte senza.
- Banner informativo: "Il Rapporto principale verrà creato automaticamente con questi dati. Per modificarlo successivamente, le modifiche su nome/codice/IBAN/sede/note/conto si propagano in automatico."
- Nessun pulsante "Nuovo Rapporto" per questi tipi (già gestito in `RapportiCompagniaDialog.tsx`).

### 3) Verifica post-migrazione
- Query di controllo: tutte le agenzie/direzioni hanno esattamente 1 rapporto principale.
- Aprire `ProvvigioniCompagniaDialog` su una delle 18 ex-anomalie e confermare che ora mostra il rapporto (badge "vuoto").

## Cosa NON tocco
- Tabella `compagnia_rapporti` (struttura invariata).
- Logica per altri tipi (broker, plurimandataria, sub-agenzia, ecc.) → N:N resta com'è.
- `ProvvigioniCompagniaDialog` appena rifatto.
- Provvigioni esistenti.

## Dettagli tecnici
- Migrazione SQL singola: 1 backfill + 1 `CREATE OR REPLACE FUNCTION` (trigger esistente) + 1 nuovo trigger BEFORE INSERT/UPDATE su `compagnie`.
- Edit frontend: solo zod schema + label/asterisco nel form compagnia. Nessun cambio di rotta o di RLS.
