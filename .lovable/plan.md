
## Problema

L'utente `segreteria@consulbrokers.it` (ruolo `ufficio`, sede Napoli) sul dettaglio titolo `/titoli/d046ffeb-2ed1-43cc-ba03-a07cfb838804` vede **"Titolo non trovato"**. Stesso problema atteso su lista titoli e altre entità: la query torna vuota → RLS blocca.

## Investigazione necessaria

Devo verificare in DB:
1. Esiste il titolo `d046ffeb...`? A quale `ufficio_id` appartiene?
2. Quale ufficio ha la segreteria? (`f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a` = Napoli)
3. RLS su `titoli`, `clienti`, `sinistri`, `movimenti_contabili` ecc. — come sono filtrati per ruolo `ufficio`?
4. La funzione `has_role` / il check su `ufficio_id` del profilo come funziona?

Ipotesi più probabile: le policy RLS per ruolo `ufficio` filtrano per `ufficio_id = profile.ufficio_id`, e i titoli storici sono associati a un altro ufficio (es. Potenza/Milano), quindi Napoli non li vede. Oppure manca completamente una policy SELECT per ruolo `ufficio` su alcune tabelle.

## Piano

### Step 1 — Diagnosi (read-only, faccio io appena approvi)
Eseguo query su:
- `titoli` per il record `d046ffeb...` → `ufficio_id`, `cliente_id`
- `profiles` per segreteria → conferma `ufficio_id`
- `pg_policies` su `titoli`, `clienti`, `sinistri`, `movimenti_contabili`, `appendici`, `pagamenti_provvigioni`, `rimesse_compagnia` → vedo le policy SELECT per ruolo `ufficio`
- conta righe visibili a segreteria simulando il filtro

### Step 2 — Decidere lo scope visibilità per ruolo `ufficio`

Mi serve chiarire **una sola cosa**: l'utente `ufficio` (segreteria) deve vedere:
- **(A) tutti i dati di tutte le sedi** (visibilità globale, come admin ma senza permessi distruttivi), oppure
- **(B) solo i dati della propria sede** (Napoli) — ma allora i titoli storici associati ad altri uffici restano invisibili.

Dato che è "Segreteria Consulbrokers" (centrale) e in passato il ruolo `ufficio` viene descritto come "backoffice/sede operativa principale", suppongo **(A)**, ma chiedo conferma prima di toccare RLS.

### Step 3 — Fix RLS (dopo conferma)

Se **(A)**: aggiungo/modifico policy SELECT su tutte le tabelle business per consentire al ruolo `ufficio` la lettura completa, allineato a quanto già fatto per `admin`. Pattern:
```sql
CREATE POLICY "Ufficio can view all <table>"
ON public.<table> FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'ufficio'));
```
Tabelle target (da confermare in step 1): `titoli`, `clienti`, `prospect`, `sinistri`, `appendici`, `movimenti_contabili`, `pagamenti_provvigioni`, `rimesse_compagnia`, `note_restituzione`, `trattative`, `nominativi_cliente`, `contatti_cliente`, e tutte quelle dove oggi solo `admin` ha SELECT.

Se **(B)**: verifico solo che le policy `ufficio_id = profile.ufficio_id` siano presenti e funzionanti, e segnalo che i titoli di altre sedi resteranno invisibili (servirebbe assegnare il titolo a Napoli).

### File coinvolti
- 🆕 Nuova migration SQL con le policy SELECT mancanti per ruolo `ufficio`.
- Nessuna modifica codice frontend.

### Domanda bloccante prima di procedere
Confermi che **segreteria/ruolo ufficio = visibilità globale read** (opzione A)?
