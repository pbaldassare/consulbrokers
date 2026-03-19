

## Piano: Collegamento Cliente ↔ Polizze ↔ Aziende

### Situazione attuale

- La tabella `clienti` (anagrafica) non ha alcun collegamento diretto con `titoli` (polizze). Attualmente `titoli.cliente_id` punta a `profiles` (utenti auth), non a `clienti`.
- Non esiste una tabella di relazione tra clienti privati e aziende.
- Non c'e navigazione bidirezionale cliente ↔ polizza.

### Modifiche previste

#### 1. Database — Nuove tabelle e colonne

**a) Colonna `cliente_anagrafica_id` su `titoli`**
- Aggiungere `cliente_anagrafica_id UUID REFERENCES clienti(id)` alla tabella `titoli`
- Questo collega ogni polizza direttamente all'anagrafica cliente
- RLS policies coerenti con quelle esistenti su titoli

**b) Tabella `clienti_relazioni`** (collegamento privato ↔ azienda)
```text
clienti_relazioni
├── id (uuid, PK)
├── cliente_id (uuid FK → clienti.id)     -- es. persona fisica
├── cliente_collegato_id (uuid FK → clienti.id) -- es. azienda
├── tipo_relazione (text: 'dipendente', 'legale_rappresentante', 'referente', 'socio')
├── note (text)
├── created_at (timestamptz)
```
- RLS: admin ALL, ufficio select/insert/update own (via ufficio_id su clienti)

#### 2. ClienteDetail — Nuovi tab

**Tab "Polizze"**: query `titoli` dove `cliente_anagrafica_id = id`, mostra tabella con numero polizza, compagnia, stato, premio, data. Click su riga → naviga a `/portafoglio/titoli/:id`.

**Tab "Aziende Collegate"** (per privati) / **Tab "Persone Collegate"** (per aziende):
- Lista delle relazioni da `clienti_relazioni`
- Possibilita di aggiungere un collegamento cercando un cliente esistente
- Click su nome → naviga al dettaglio del cliente collegato
- Badge con tipo relazione (dipendente, socio, ecc.)

#### 3. TitoloDetail — Link al cliente anagrafica

- Aggiungere nella card dati del titolo un link cliccabile al cliente anagrafica: "Cliente: Mario Rossi →" che naviga a `/archivi/clienti/:id`

#### 4. Form creazione titolo (TitoliList)

- Aggiungere un campo "Cliente Anagrafica" con ricerca autocomplete sulla tabella `clienti` (cerca per nome/cognome/ragione sociale/CF)
- Il campo popola `cliente_anagrafica_id` al salvataggio

### File coinvolti

| Azione | File |
|--------|------|
| Migration | Aggiunta colonna `cliente_anagrafica_id` a `titoli` + tabella `clienti_relazioni` + RLS |
| Modificare | `src/pages/ClienteDetail.tsx` — aggiungere tab Polizze e Relazioni |
| Modificare | `src/pages/TitoloDetail.tsx` — link navigabile al cliente anagrafica |
| Modificare | `src/pages/TitoliList.tsx` — campo ricerca cliente anagrafica nel form |

### Flusso di navigazione

```text
ClientiList → ClienteDetail
                ├── Tab Polizze → click riga → TitoloDetail
                │                                  └── Link "Cliente" → ClienteDetail
                └── Tab Aziende Collegate → click → ClienteDetail (azienda)
```

