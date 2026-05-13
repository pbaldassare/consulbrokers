## Obiettivo
Permettere l'eliminazione di un Cliente dal database **preservando** lo storico collegato (polizze, sinistri, documenti, prospect di origine) — il cliente sparisce dall'anagrafica ma i record collegati restano "orfani" con riferimento nullo.

## Analisi FK attuali su `clienti`
Verificate via `pg_constraint`:

| Tabella | Colonna | Regola attuale | Azione richiesta |
|---|---|---|---|
| `titoli` | `cliente_anagrafica_id` | NO ACTION (blocca) | **SET NULL** |
| `sinistri` | `cliente_anagrafica_id` | NO ACTION (blocca) | **SET NULL** |
| `prospect` | `convertito_cliente_id` | NO ACTION (blocca) | **SET NULL** |
| `storico_gare` | `cliente_id` | SET NULL | OK |
| `clienti.merged_into` | self | SET NULL | OK |
| `trattative`, `clienti_relazioni`, `codici_commerciali_cliente`, `nominativi_cliente`, `clienti_merge_log`, `richieste_modifica_cliente`, `privacy_consensi` | — | CASCADE | OK (dati strettamente legati al cliente: vanno via con lui) |
| `note_restituzione`, `portafoglio_incassi` | `cliente_id` | (no FK formale) | nessuna modifica |

`documenti` usa già pattern polimorfico (`entity_type/entity_id`) — nessuna FK fisica, restano automaticamente.

## Piano

### 1. Migrazione DB
- Drop e re-create dei 3 FK bloccanti come `ON DELETE SET NULL`:
  - `titoli.cliente_anagrafica_id`
  - `sinistri.cliente_anagrafica_id`
  - `prospect.convertito_cliente_id`
- Nessuna modifica alle CASCADE esistenti (relazioni tecniche del cliente).

### 2. UI — pulsante "Elimina cliente" in `ClienteDetail`
Aggiungere accanto a "Modifica" un pulsante **destructive** "Elimina" visibile solo a ruoli `admin` (RoleGuard). Apre `DeleteWithImpactDialog` (componente già esistente) con:

- `entityType="cliente"`, `entityName={ragione_sociale || nome cognome}`
- `checks` (tutti **non bloccanti**, solo informativi):
  - Polizze collegate (`titoli` where `cliente_anagrafica_id`)
  - Sinistri collegati (`sinistri`)
  - Documenti collegati (`documenti` where `entity_type='cliente'`)
  - Trattative (info: verranno eliminate in cascade)
  - Privacy consensi (info: cascade)
- `extraNotes`: spiegazione che polizze/sinistri/documenti **restano** nello storico ma senza link al cliente (visibili come "Cliente rimosso").

### 3. Handler eliminazione
`supabase.from('clienti').delete().eq('id', clienteId)` → toast → redirect a `/archivi/clienti`. Audit trail già automatico via trigger esistente.

### 4. Visualizzazione record orfani
Nei punti dove si mostra il nome cliente partendo da `titoli`/`sinistri`, fallback a `"— Cliente rimosso —"` quando il join è null. Da verificare in:
- `PortafoglioList`/`PortafoglioDetail`
- `TitoloDetail`
- `SinistriList`/`SinistroDetail`

(Modifiche minime: solo aggiungere `?? "— Cliente rimosso —"` ai render).

## Out of scope
- Soft-delete con flag `deleted_at` (non richiesto, e l'audit trail copre già la tracciabilità).
- Modifica RLS (admin ha già delete su `clienti`).
