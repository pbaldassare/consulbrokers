
# Multi-sede per Specialist e Account Executive

## Obiettivo
Permettere a uno **Specialist** (ruolo DB `backoffice`) e a un **Account Executive** di essere collegati a **più Sedi**. Su tutte le sedi collegate ottengono **lettura e scrittura piena** su clienti, titoli, sinistri, movimenti contabili. La **Sede primaria** resta unica e governa default (IBAN, log, intestazioni email).

## Modello dati

Nuova tabella ponte:

```text
profilo_sedi
├─ profilo_id  uuid  → profiles.id
├─ ufficio_id  uuid  → uffici.id
├─ primaria    bool  (max una per profilo)
└─ PK (profilo_id, ufficio_id)
```

- `profiles.ufficio_id` resta come **sede primaria** (retro-compatibilità, default operativo).
- Un trigger sincronizza: ogni `profiles.ufficio_id` non null genera una riga `profilo_sedi` con `primaria=true`; viceversa la riga `primaria=true` aggiorna `profiles.ufficio_id`.
- Solo profili con `ruolo IN ('backoffice','account_executive')` possono avere righe multiple; un trigger rifiuta righe extra per gli altri ruoli (Sede, Resp. Sede, Produttore, Admin restano single-sede / globali).

## Visibilità (RLS)

Nuova funzione SQL:

```sql
get_my_ufficio_ids() → uuid[]
-- ritorna l'unione di profilo_sedi.ufficio_id per auth.uid()
-- fallback: [profiles.ufficio_id] se la ponte è vuota
```

Aggiornare le policy `... own ...` su **clienti, titoli, sinistri, movimenti_contabili** **solo per i ruoli `backoffice` e `account_executive`**:

- vecchio: `ufficio_id = get_my_ufficio_id()`
- nuovo:   `ufficio_id = ANY(get_my_ufficio_ids())`

Le policy del ruolo `ufficio` (login Sede) **restano single-sede** (es. `segreteria@` Napoli continua a vedere solo Napoli). Admin invariato (`Admin all`).

Stessa estensione su tabelle correlate che usano già `get_my_ufficio_id()` (es. `note_restituzione`, `appendici_polizza`, `titoli_*`, `provvigioni_generate`, ecc.): sostituire con `ANY(get_my_ufficio_ids())` nelle sole policy `backoffice`/`account_executive`.

## UI

**Anagrafiche Amministrative → Specialist** e **→ Account Executive**:
- sostituire il select singolo "Sede" con un blocco **"Sedi collegate"**:
  - lista di tutte le sedi attive con checkbox
  - una sede marcata "★ Primaria" (radio); le altre "Secondarie"
  - salva su `profilo_sedi` + aggiorna `profiles.ufficio_id` = primaria
- in **Centro Utenti & Privilegi** (`UserPermissionsSheet` tab Anagrafica) mostrare l'elenco delle sedi collegate in sola lettura con badge "Primaria", con link alla pagina Anagrafiche Amministrative per la gestione.

Nessuna modifica al filtro dati frontend: le query continuano a passare per RLS, quindi i record delle sedi secondarie compaiono automaticamente.

## Default operativi (invariati)
- `logAttivita` → `profiles.ufficio_id` (primaria).
- IBAN resolution chain → primaria (poi cliente → fallback Consulbrokers).
- Email/intestazioni → primaria.

## Migrazione dati esistenti
Per ogni `profiles` con `ruolo IN ('backoffice','account_executive')` e `ufficio_id` non null, inserire una riga `profilo_sedi (profilo_id, ufficio_id, primaria=true)`. Nessun dato perso.

## Memoria progetto da aggiornare
Aggiungere memoria `auth/multi-sede-specialist-ae` e aggiornare `auth/rbac-system` con la regola `get_my_ufficio_ids()` per backoffice/AE.

## Out of scope
- Resp. Sede e ruolo `ufficio` restano single-sede.
- Nessuna modifica a Produttori, Corrispondenti, Cliente, Prospect.
- Nessuna modifica a report/E-C esistenti: si limitano automaticamente al perimetro RLS dell'utente.
