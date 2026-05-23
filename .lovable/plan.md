
# Sostituzione & Estinzione Polizza — piano finale

Risposte utente integrate:
- **Nessun calcolo automatico del rateo**: l'utente inserisce a mano gli importi (conguaglio sostituzione / rimborso estinzione). Il sistema mostra solo le rate future per riferimento.
- **Storico oggetto sostituito**: nuova tabella `titoli_sostituzioni` (migrazione DB).
- **Conguaglio sostituzione**: **1 solo titolo** riassuntivo.
- **Penale estinzione**: **eliminata dal modello**. Solo eventuale rimborso al cliente (importo a mano).

---

## 1. Rimozione Duplicazione

- Tolgo pulsante **Duplicazione** dalla card Operazioni di `TitoloDetail.tsx` (+ import `Copy` se orfano).
- `DuplicazionePolizzaPage.tsx` resta nel codebase (non tocco router). Da rimuovere a parte se confermi.

Nuovi pulsanti card Operazioni:
- **Sostituzione** (icona `Replace`)
- **Estinzione** (icona `Ban`, stile rosso)

Visibilità: solo se `stato ∈ {attivo, sospeso}`. Disabilitati per `incassato/stornato/estinto`.

---

## 2. SOSTITUZIONE

> Il contratto **resta in essere**: stesso `numero_titolo`, stesse scadenze, stesse quietanze future. Cambia solo l'**oggetto** (veicolo/bene/parametri tecnici). Eventuale differenza di premio → 1 titolo di conguaglio (positivo o negativo) inserito a mano.

### 2.1 Esempi concreti

**RCA Auto — cambio veicolo, conguaglio POSITIVO**
```text
Polizza 434334433 - veicolo "FIAT Panda AA111BB"
Periodo 01/01/2026–31/12/2026, Trimestrale, 1.200 €/anno
Rata 1 INCASSATA, Rata 2 INCASSATA, Rata 3 ATTIVA, Rata 4 ATTIVA
```
Sostituzione 20/08/2026 con "BMW Serie 3 CC222DD". L'utente inserisce a mano conguaglio +437 €.
Risultato:
- Polizza aggiornata: nuovi dati veicolo (marca/modello/targa/telaio/classe BM).
- Storico precedente salvato in `titoli_sostituzioni` (snapshot vecchio + nuovo).
- Rate 3 e 4 **invariate** (premio originario).
- Nuovo titolo "Conguaglio Sostituzione" 437 € — `stato='attivo'`, `data_messa_cassa NULL`, split provvigioni copiato dalla madre → Carico del Mese normale.
- Movimento `SO`, log `sostituzione_polizza`, allegato opzionale.

**Conguaglio NEGATIVO**: importo -109 € → titolo con `premio_lordo=-109` ("Rimborso Conguaglio Sostituzione") → quando contabilizzato genera rimborso + storno parziale provvigioni.

**Sostituzione pura (premio invariato)**: utente lascia conguaglio = 0 → solo update parametri + record `titoli_sostituzioni` + movimento `SO` + log. Nessun titolo conguaglio.

---

## 3. ESTINZIONE

> Chiusura anticipata del contratto. Le quietanze future non incassate vengono cancellate. Eventuale rimborso al cliente (importo a mano). **Nessun concetto di penale**.

### 3.1 Esempi concreti

**Con rimborso**
```text
Stessa polizza, rata 3 INCASSATA, rata 4 ATTIVA
Estinzione 20/08/2026 (recesso cliente)
```
Utente inserisce a mano rimborso 137 €.
Risultato:
- Polizza madre → `stato='estinto'`, `data_estinzione=20/08/2026`, `causale_estinzione`, `motivo_estinzione`.
- Rata 4 cancellata (con pulizia `movimenti_polizza` + `premi_garanzia_polizza` collegati, stesso pattern Sospensione).
- Nuovo titolo "Rimborso Estinzione" -137 € — split copiato dalla madre, da contabilizzare → genera storno provvigioni + rimborso cliente.
- Movimento `ES`, log `estinzione_polizza`, allegato opzionale (lettera disdetta).

**Senza rimborso**: utente lascia rimborso = 0 → solo update stato + cancellazione future + movimento `ES` + log.

---

## 4. Modali

### 4.1 `SostituzionePolizzaDialog.tsx`
- **Dati sostituzione**: data (default oggi), causale (Select: Cambio veicolo / Cambio bene / Variazione massimali / Aggiornamento dati / Altro), motivo (textarea).
- **Nuovi parametri oggetto**:
  - Per RCA Auto: targa, marca, modello, telaio (compilazione manuale; campi precompilati con valori attuali).
  - Altri rami: textarea "Descrizione nuovo oggetto".
- **Conguaglio**: input numerico libero (default 0, accetta valori negativi). Label: "Importo conguaglio (positivo = a carico cliente, negativo = rimborso)".
- **Tabella riferimento** (read-only): elenco rate future con importi correnti, mostrata sotto al campo conguaglio per orientamento.
- Allegato opzionale (max 10 MB, nome editabile).
- AlertDialog conferma con riepilogo.

### 4.2 `EstinzionePolizzaDialog.tsx`
- **Dati estinzione**: data (default oggi), causale (Select: Recesso cliente / Recesso compagnia / Vendita bene / Cessazione attività / Disdetta anticipata / Sinistro totale / Altro), motivo (textarea).
- **Tabella riferimento** (read-only): elenco quietanze future che verranno cancellate (`numero_titolo` + riga + periodo + importo).
- **Rimborso cliente**: input numerico (default 0). Label: "Importo rimborso al cliente (€)". Se > 0 → genera titolo negativo.
- Allegato opzionale.
- AlertDialog conferma con riepilogo (rate cancellate + rimborso).

---

## 5. Mutation

### 5.1 Sostituzione
1. Insert `titoli_sostituzioni` con snapshot vecchi parametri + nuovi.
2. Update polizza madre con nuovi parametri tecnici (veicolo / descrizione oggetto).
3. Se `conguaglio !== 0`: insert nuovo titolo "Conguaglio Sostituzione DD/MM/YYYY" — stesso `numero_titolo`, `premio_lordo=conguaglio`, split provvigioni copiato dalla rata madre (sede/specialist/produttore), `stato='attivo'`, `data_messa_cassa NULL`.
4. Upload documento opzionale (`documenti_titoli/titolo/{id}/sostituzione_{ts}_{name}` + riga `documenti`).
5. Insert `movimenti_polizza` con `tipo_documento='SO'`, `stato='attivo'`, descrizione composta.
6. `logAttivita('sostituzione_polizza', 'titolo', id, { data, causale, motivo, nuovi_parametri, conguaglio, titolo_conguaglio_id, sostituzione_id, documento_id })`.
7. Invalidate: `titolo`, `movimenti-polizza`, `timeline`, `documenti`, `portafoglio-attive/storico/carico`.

### 5.2 Estinzione
1. Fetch rate future con stesso `numero_titolo`, `riga > corrente`, `stato != 'incassato'`, `data_messa_cassa IS NULL`.
2. Update polizza madre: `stato='estinto'`, `data_estinzione`, `causale_estinzione`, `motivo_estinzione`.
3. Cancella quietanze future (pulizia preventiva `movimenti_polizza` + `premi_garanzia_polizza`).
4. Se `rimborso > 0`: insert titolo "Rimborso Estinzione DD/MM/YYYY" con `premio_lordo=-rimborso`, split copiato dalla madre, `stato='attivo'`, `data_messa_cassa NULL`.
5. Upload documento opzionale (`/estinzione_{ts}_{name}`).
6. Insert `movimenti_polizza` con `tipo_documento='ES'`, `stato='estinto'`.
7. `logAttivita('estinzione_polizza', 'titolo', id, { data, causale, motivo, quietanze_cancellate, rimborso, titolo_rimborso_id, documento_id })`.
8. Invalidate query.

---

## 6. Effetti contabili (sostituzione + estinzione)

- Titoli conguaglio/rimborso entrano nel ciclo normale: Carico del Mese → Messa a Cassa → trigger `calcola-provvigioni` → split Sede/Specialist/Produttore (copiato dalla madre).
- Titoli con `premio_lordo < 0` producono provvigioni negative (storno coerente con quota madre).
- Compaiono in E/C Cliente, E/C Agenzia, E/C Produttore.
- Polizza madre estinta sparisce da "Attive" (filtro `stato IN (attivo, sospeso)`), entra in "Storico" → confermare se serve aggiornare filtro per includere `estinto` (probabilmente sì, già fa per `scaduto/incassato/stornato`).
- Trigger `prevent_double_messa_cassa` invariato.

---

## 7. UI TitoloDetail

- `stato='estinto'` → entra in `isLocked` (come `incassato/stornato`). Banner ambra: "Polizza Estinta in data … – causale".
- `stato='attivo'` post-sostituzione: nessun lock; banner azzurro: "Polizza Sostituita in data … (cambio oggetto)" con link al record `titoli_sostituzioni` ultimo e al titolo conguaglio (se presente).
- Pulsanti Sostituzione/Estinzione nella card Operazioni con stessa logica enable/disable di Sospensione/Riattivazione.

---

## 8. Migrazione DB (approvazione separata)

```sql
-- 1. nuovi campi su titoli per estinzione
ALTER TABLE titoli
  ADD COLUMN data_estinzione date,
  ADD COLUMN causale_estinzione text,
  ADD COLUMN motivo_estinzione text,
  ADD COLUMN data_sostituzione date,
  ADD COLUMN motivo_sostituzione text;

-- 2. estensione stato (se è enum) → 'estinto'
ALTER TYPE titoli_stato ADD VALUE IF NOT EXISTS 'estinto';

-- 3. estensione movimenti_polizza.tipo_documento → 'SO', 'ES' (se enum)
ALTER TYPE tipo_documento_mov ADD VALUE IF NOT EXISTS 'SO';
ALTER TYPE tipo_documento_mov ADD VALUE IF NOT EXISTS 'ES';

-- 4. tabella titoli_sostituzioni (storico oggetto sostituito)
CREATE TABLE titoli_sostituzioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES titoli(id) ON DELETE CASCADE,
  data_sostituzione date NOT NULL,
  causale text,
  motivo text,
  parametri_precedenti jsonb NOT NULL,  -- snapshot vecchio veicolo/bene
  parametri_nuovi jsonb NOT NULL,        -- snapshot nuovo veicolo/bene
  conguaglio numeric(12,2) DEFAULT 0,
  titolo_conguaglio_id uuid REFERENCES titoli(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

-- RLS coerente con titoli (stesse policy: visibili a chi vede il titolo madre)
ALTER TABLE titoli_sostituzioni ENABLE ROW LEVEL SECURITY;
-- (policy definite in fase di migrazione)
```

Aggiorno memorie:
- `mem://insurance/policy-states` → aggiungo `estinto`.
- `mem://insurance/portfolio-management-views` → conferma che `estinto` rientra in "Storico".
- Nuova `mem://insurance/policy-replacement-extinction-rules` con regole complete.

---

## 9. File toccati

- **modifica**: `src/pages/TitoloDetail.tsx` (rimuove Duplicazione, aggiunge 2 pulsanti + state + render dialog + banner estinto/sostituita).
- **nuovo**: `src/components/polizze/SostituzionePolizzaDialog.tsx`
- **nuovo**: `src/components/polizze/EstinzionePolizzaDialog.tsx`
- **modifica**: `src/pages/PortafoglioStoricoPage.tsx` (filtro stati: includere `estinto`).
- **migrazione DB** come sopra.
- **nuova memoria** `mem://insurance/policy-replacement-extinction-rules` + aggiornamento `policy-states` + index.
- bump `public/version.json`.

---

Appena confermi parto con: 1) migrazione DB, 2) creazione modali + integrazione `TitoloDetail`, 3) memoria.
