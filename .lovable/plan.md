## Nuova tabella `causali_movimento_contabile`

La tabella esistente `causali_contabili` è già occupata come registro delle tabelle base (codici `TBDS*`), quindi creo una tabella nuova dedicata alle causali contabili operative (ABP, AIN, CAV...).

### Schema
- `id` uuid PK
- `codice` text UNIQUE NOT NULL (es. `ABP`)
- `descrizione` text NOT NULL (es. `ABBUONO PASSIVO`)
- `segno` text CHECK in (`dare`, `avere`, `entrambi`) DEFAULT `entrambi` — utile per futura logica contabile
- `attiva` boolean DEFAULT true
- `note` text NULL
- `created_at`, `updated_at` timestamptz

### Seed iniziale
| Codice | Descrizione |
|---|---|
| ABP | ABBUONO PASSIVO |
| AIN | ACCONTO SU INCASSI |
| CAV | ABBUONO ATTIVO |
| GGC | GIROCONTO |
| GLP | LIQUIDAZIONE PROVVIGIONI |
| MEN | MINOR INCASSO |
| MIN | MAGGIORE INCASSO |

### RLS / Grants
- `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated`, `ALL … TO service_role`.
- Policy lettura: tutti gli utenti autenticati.
- Policy scrittura (insert/update/delete): solo admin via `has_role(auth.uid(),'admin')`.

### UI
In questa fase nessuna pagina UI — mi indicherai dopo dove collegarla (es. selettore in prima nota, rimesse, ecc.). Eventuale CRUD in "Tabelle Base" lo aggiungiamo al passo successivo.

### Conferma
Va bene il nome `causali_movimento_contabile`? In alternativa posso chiamarla `causali_operative` o riservarla diversamente.
