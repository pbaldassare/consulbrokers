

## Piano: Piano dei Conti con Centri di Costo, Sottocentri e Anagrafiche

### Cosa si costruisce

Un sistema gerarchico a 3 livelli per la contabilità generale:

```text
CENTRO DI COSTO (livello 1)     codice 6 cifre, es. "010101"
  └── SOTTOCENTO (livello 2)     codice 6 cifre, es. "000001"
        └── ANAGRAFICA (dettaglio)  campi: IBAN, BIC, Città, CF/P.IVA, etc.
```

Ogni conto ha: Descrizione, Sezione Bilancio, Natura (Patrimoniale/Economico + Attivo/Passivo), Gestione partite, Tipo Sezionale (No/Clienti/Fornitori), Voce di spesa, Flag stato, Gestione tesoreria, dati bancari.

### 1. Database (3 nuove tabelle)

**`piano_conti_gruppi`** (Centri di Costo — livello 1):
- `id` uuid PK, `codice` text UNIQUE (6 cifre, es. "010101"), `descrizione` text
- `sezione_bilancio` text, `natura_tipo` text (Patrimoniale/Economico), `natura_segno` text (Attivo/Passivo)
- `attivo` boolean DEFAULT true, `created_at`, `updated_at`

**`piano_conti_conti`** (Sottocentri — livello 2):
- `id` uuid PK, `gruppo_id` FK → piano_conti_gruppi, `codice` text (6 cifre, es. "000001")
- `descrizione` text, `sezione_bilancio` text, `natura_tipo` text, `natura_segno` text
- `gestione_partite` boolean, `tipo_sezionale` text (no/clienti/fornitori), `voce_spesa` text
- `flag_stato` boolean, `data_sospensione` date, `gestione_tesoreria` boolean
- `iban` text, `bic` text, `citta` text, `cf_piva` text
- `attivo` boolean DEFAULT true, UNIQUE(gruppo_id, codice)

**`sezioni_bilancio`** (lookup per il dropdown Sezione Bilancio):
- Contiene le ~25 voci visibili nello screenshot: CREDITI VERSO SOCI, IMMOBILIZZ. IMMATERIALI, IMMOBILIZZ. MATERIALI, IMMOBILIZZ. FINANZIARIE, ASSICURATI, CLIENTI, DEBITORI DIVERSI, FORNITORI, COMPAGNIE, CREDITORI DIVERSI, ASS./COMP. C/D'ORDINE, CASSA, BANCHE, PORTAFOGLIO, ALTRE ATTIVITA' FINANZ., RATEI E RISCONTI, F.DO AMM. IMM. MATERIALI, F.DO AMM. IMMOB. IMMATER., etc.

### 2. Dati demo pre-compilati

| Gruppo (Centro) | Codice | Sottocentri esempio |
|---|---|---|
| CREDITI VERSO SOCI | 010101 | 000001 CREDITI VERSO SOCI, 000002 OBBLIGAZIONISTI C/SOTT.NI |
| IMMOBILIZZ. IMMATERIALI | 020101 | 000001 SPESE PRIMO IMPIANTO, 000002 COSTI PLURIENNALI, 000003 SOFTWARE, 000004 PORTAFOGLI ASSICURATIVI, 000005 ATTIVITA' FINANZIARIE, 000006 SPESE CERT. DI QUALITA' |
| BANCHE | 060101 | 000001 BANCA VALSABBINA, 000002 BCC ROMA, 000003 INTESA SANPAOLO |
| FORNITORI | 050101 | 000001 BOLLETTE TELEFONICHE, 000002 ENERGIA ELETTRICA, 000003 AFFITTO UFFICI |
| CASSA | 070101 | 000001 CASSA SEDE NAPOLI, 000002 CASSA SEDE ROMA |

~8 gruppi con ~30 sottoconti totali, tutti con sezione bilancio e natura corretti.

### 3. Nuova pagina `PianoDeiContiPage.tsx`

Sostituisce il placeholder "Anagrafiche" in `/cont-generale/anagrafiche`.

**Layout:**
- Lista gruppi a sinistra (tabella con Gruppo, Descrizione, Natura, n.conti)
- Click su gruppo → espande i sottoconti inline (accordion)
- Click su sottoconto → Dialog "Dettaglio Conto" (come nello screenshot legacy) con tutti i campi
- Bottoni: NUOVO gruppo, NUOVO sottoconto, modifica, stampa
- SearchableSelect per Sezione Bilancio e Voce di spesa
- Radio buttons per Tipo Sezionale (No/Clienti/Fornitori)
- Checkbox per Gestione partite, Flag stato, Gestione tesoreria

### 4. Modifiche ai file esistenti

| File | Modifica |
|---|---|
| **Migration SQL** | CREATE 3 tabelle + INSERT dati demo + RLS policies |
| **`PianoDeiContiPage.tsx`** (nuovo) | Pagina completa con CRUD gruppi e conti |
| **`routes/contabilita.tsx`** | Sostituire PlaceholderPage con PianoDeiContiPage su `/cont-generale/anagrafiche` |
| **`AppSidebar.tsx`** | Rinominare "Anagrafiche" → "Piano dei Conti" |

### Dettagli tecnici

- I codici a 6 cifre sono text con validazione frontend (regex `^\d{6}$`)
- Auto-generazione codice: prossimo disponibile nel gruppo
- La tabella `sezioni_bilancio` viene usata come lookup per il SearchableSelect
- RLS: accesso authenticated su tutte e 3 le tabelle (lettura per tutti, scrittura solo admin)
- Il collegamento con primanota_generale avverrà in un secondo momento tramite FK su `piano_conti_conti.id`

