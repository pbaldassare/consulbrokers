

## Analisi

Vedo nello screenshot 4 righe identiche del titolo `332437574` con scadenza 04/04/2027 (Comune di Santa Marina Salina - ASSISUD), tutti creati per errore dal rinnovo. L'utente chiede due cose:

1. **Bloccare la duplicazione**: impedire che lo stesso titolo possa essere rinnovato più volte (creando duplicati)
2. **Cleanup**: eliminare le 4 righe duplicate `332437574` con scadenza 04/04/2027

## Verifiche da fare

1. Query DB per contare esattamente quanti `titoli` esistono con `numero_polizza = '332437574'` e `data_scadenza = '2027-04-04'`, con i relativi `id`, `created_at`, `movimenti_polizza` collegati e `messa_a_cassa`/incassi.
2. Capire se uno di questi è "originale" (il primo) o sono tutti duplicati di un rinnovo.
3. Verificare in `RinnovoTitoloDialog.tsx` perché non c'è un check di esistenza prima dell'insert.

## Piano implementazione

### 1. Prevenzione duplicati nel rinnovo (`RinnovoTitoloDialog.tsx`)

Prima di creare il nuovo titolo, controllare se esiste già un titolo con:
- stesso `numero_polizza`
- stesso `compagnia_id`
- stessa `data_decorrenza` calcolata (la nuova decorrenza del rinnovo)

Se esiste → mostrare toast "Rinnovo già esistente" + bottone "Vai al titolo esistente" e **NON** creare nulla. Bloccare anche la mutation con `disabled` se il check pre-conferma rileva il duplicato.

### 2. Vincolo a livello DB (consigliato)

Aggiungere un **unique index parziale** su `titoli`:
```sql
CREATE UNIQUE INDEX titoli_numero_decorrenza_unique 
ON titoli (numero_polizza, compagnia_id, data_decorrenza)
WHERE numero_polizza IS NOT NULL;
```
Così anche un doppio click o due tab aperte non possono mai creare duplicati: il secondo insert fallirà a livello DB.

### 3. Cleanup dati esistenti

Migrazione SQL one-shot che:
- Identifica tutti i titoli con `numero_polizza = '332437574'` e `data_scadenza = '2027-04-04'`
- **Mantiene il più vecchio** (primo `created_at`) come "originale"
- Per gli altri:
  - elimina i `movimenti_polizza` collegati (e relativi `log_attivita` se presenti)
  - elimina le righe `titoli` duplicate
- Se il "primo" è anch'esso un rinnovo errato (cioè non esisteva una polizza precedente con quella scadenza), va valutato se eliminare TUTTE le 4 righe come chiede l'utente ("annulla tutte le 332437574 con scadenza 4-4-2027")

**Lettura della richiesta**: l'utente dice "annulla tutte" → eliminare **tutte e 4** le righe `332437574` con `data_scadenza = 2027-04-04`. Confermo questa interpretazione prima di procedere.

## Domanda di conferma

Devo chiedere se eliminare TUTTE e 4 le occorrenze, o tenerne 1 (il rinnovo "vero") e cancellare le altre 3 duplicate.

## File toccati

- 1 nuova migrazione SQL (unique index + cleanup duplicati)
- `src/components/polizze/RinnovoTitoloDialog.tsx` (check pre-insert + gestione errore unique)

## Cosa NON faccio

- Non tocco le RLS
- Non modifico la logica di `messa_a_cassa` o lo storico movimenti dei titoli **non** duplicati
- Non tocco altre polizze diverse da `332437574 / 2027-04-04`

