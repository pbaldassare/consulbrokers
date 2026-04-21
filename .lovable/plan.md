

## Riprova rinnovo come admin

Oggi quando provi a rifare il rinnovo della stessa polizza ricevi l'errore "Esiste già un rinnovo della polizza X con scadenza Y". Il blocco è doppio:

1. **Guardia applicativa** in `RinnovoTitoloDialog.tsx` (verifica esistenza prima di insert).
2. **Indice UNIQUE in DB** `titoli_no_duplicati_rinnovo` su `(numero_titolo, compagnia_id, data_scadenza)`.

Vuoi poter, da admin, **rifare il rinnovo** anche se ne esiste già uno (per esempio perché il primo è sbagliato e va sostituito).

## Soluzione

Aggiungo nel dialog Rinnovo un percorso **"Sostituisci rinnovo esistente"** visibile **solo agli admin**, che permette di:

1. Quando il check anti-duplicato trova un rinnovo già esistente, invece di mostrare solo il toast "Vai al titolo esistente", mostro un secondo bottone **"Elimina e rifai (admin)"** dentro il toast/dialog.
2. Cliccando, apro un piccolo confirm dialog con riepilogo:
   - Polizza che verrà eliminata: numero / riga / scadenza / stato
   - Avviso: "L'operazione cancellerà il rinnovo esistente (e i suoi movimenti) e ne creerà uno nuovo con i dati mostrati. Irreversibile."
3. Su conferma:
   - Elimino il titolo rinnovo esistente **solo se** `stato IN ('in_attesa_rinnovo', 'attivo')` e **non** ha `data_messa_cassa` valorizzata (non è ancora stato incassato). Se è già stato messo a cassa, blocco con messaggio chiaro: "Il rinnovo esistente è già stato incassato, non è eliminabile. Usa Storno."
   - I `movimenti_polizza` collegati cadono per `ON DELETE CASCADE` (se presente) — verifico la FK; in alternativa li elimino esplicitamente prima.
   - Ripristino `sostituito_da_id = NULL` sul movimento origine (per non lasciare riferimenti dangling).
   - Eseguo l'insert del nuovo rinnovo esattamente come oggi (riusa la stessa `rinnovaMutation`).
   - Loggo in `log_attivita` due eventi: `rinnovo_eliminato` (sul vecchio) + `rinnovo_polizza` (sul nuovo, già esistente oggi).

### Visibilità del pulsante

- Solo se `isAdmin === true` (da `useAuth`).
- Per utenti non admin il comportamento resta invariato (toast con "Vai al titolo esistente").

### File modificati

- `src/components/polizze/RinnovoTitoloDialog.tsx`:
  - Importo `useAuth` per leggere `isAdmin`.
  - Estendo `onError` per esporre, se admin + `titoloEsistenteId`, una seconda action "Elimina e rifai" oppure (meglio) apro un AlertDialog dedicato dentro il componente con riepilogo.
  - Aggiungo mutation `eliminaRinnovoEsistenteMutation` che fa: select stato/data_messa_cassa → delete movimenti → delete titolo → reset `sostituito_da_id` → poi richiama `rinnovaMutation.mutate()`.
  - Loggo le attività.

Nessuna modifica DB richiesta: l'indice UNIQUE resta (è una rete di sicurezza), ma viene rispettato perché il vecchio rinnovo è già stato eliminato prima dell'insert.

## Verifica

1. Da admin, su un titolo che ha già un rinnovo `in_attesa_rinnovo`, premo "Rinnovo".
2. Dialog si apre normalmente, premo "Conferma Rinnovo".
3. Compare AlertDialog "Esiste già un rinnovo — Elimina e rifai?".
4. Confermo → vecchio rinnovo cancellato, nuovo creato, atterro sulla pagina del nuovo titolo.
5. Da utente non admin lo stesso scenario mostra solo "Vai al titolo esistente" (comportamento attuale).
6. Se il rinnovo esistente è già `incassato` → messaggio chiaro che non si può eliminare.

