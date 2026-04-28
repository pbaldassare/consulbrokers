## Problema

Quando modifichi il Commerciale e salvi, in DB il valore **viene effettivamente aggiornato** (verificato: l'ultima PATCH ha settato `anagrafica_commerciale_id = 55ff2a7d-...` con successo, status 204). Il problema è solo **visivo**: nel riquadro "Commerciale & Provvigioni" continua ad apparire "INTERFIDI SRL" perché il nome mostrato viene letto da un altro campo (`produttore_nome`, testo libero del contratto), che ha priorità sul commerciale appena salvato.

Codice attuale (`src/pages/TitoloDetail.tsx` riga 2063):
```ts
const commName = t.produttore_nome || (t.commerciale ? `${t.commerciale.nome} ${t.commerciale.cognome}` : "Sede");
```
Non considera mai `anagrafica_commerciale_id` → `anagrafiche_professionali`, che è la nuova fonte di verità.

## Soluzione

### 1. Fix display Commerciale (`src/pages/TitoloDetail.tsx`)
- Caricare la query del titolo includendo il join `anagrafica_commerciale:anagrafiche_professionali!titoli_anagrafica_commerciale_id_fkey(id, ragione_sociale, nome, cognome)`.
- Cambiare la priorità del nome mostrato a:
  1. `anagrafica_commerciale.ragione_sociale` (o `cognome nome`) se presente
  2. fallback `produttore_nome` (testo libero legacy)
  3. fallback `commerciale.nome cognome` (FK profili legacy)
  4. "Sede"
- Stessa priorità nel display dopo aver chiuso l'edit.

### 2. Allineare anche `produttore_nome` al salvataggio
Per evitare incoerenze future con altre viste (es. lista titoli, report) che leggono `produttore_nome`, all'interno di `saveCommMutation` settare anche `produttore_nome`:
- Se è selezionata un'anagrafica → `produttore_nome = label dell'anagrafica` (ragione sociale o cognome+nome).
- Se "Nessuno (Sede)" → `produttore_nome = null`.

In questo modo il campo testo libero resta sincronizzato e tutti i punti del sistema vedono lo stesso nome subito dopo il salvataggio.

### 3. (Opzionale) Conferma visiva su 204
Aggiungere `.select("id").single()` alla mutation per verificare effettivamente che la riga sia stata aggiornata (ed eventualmente mostrare errore se 0 righe), in modo che in futuro un blocco RLS non passi inosservato.

## File toccati
- `src/pages/TitoloDetail.tsx` (query select + saveCommMutation + display commName)

Nessuna migrazione DB necessaria: i dati sono già corretti, è solo un bug di rendering.
