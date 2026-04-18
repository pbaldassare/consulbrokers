
## Analisi richiesta

L'utente vuole che nella chat **Interna** la ricerca utenti funzioni su:
- email
- nome / cognome
- telefono
- note

Escludendo i clienti (ruolo `cliente`) e probabilmente anche `prospect`/`corrispondente` se vogliamo solo "utenti del sistema". Da confermare con domanda? No: dice esplicitamente "tutti TRANNE i clienti".

Esploro la chat per capire dove avviene la ricerca utenti.

## File da ispezionare
- `src/components/chat/NuovaConversazioneDialog.tsx` — dove si cercano utenti per nuova conversazione
- `src/components/chat/CanaliSidebar.tsx` — barra ricerca canali esistenti
- `src/components/ChatTab.tsx` — eventuale ricerca contestuale

## Piano

### 1. `NuovaConversazioneDialog.tsx` (Interna)
Estendere la query Supabase su `profiles`:
- Filtro `ruolo != 'cliente'` (mantenere prospect/corrispondente solo se già inclusi oggi — verifico)
- Ricerca `.or()` su: `email`, `nome`, `cognome`, `telefono`, `note`
- Debounce 350ms (già standard progetto)
- Mostrare nei risultati: nome+cognome, email piccola, e badge ruolo
- Avatar con `avatar_url` se presente

### 2. `CanaliSidebar.tsx` — ricerca tra conversazioni esistenti
Quando l'utente scrive nel campo "Cerca...", filtrare i canali anche per:
- nome partecipante
- email partecipante
- telefono / note partecipante

Se la lista canali è già lato client, fare match su tutti i campi dei partecipanti già caricati. Se serve query, aggiungere RPC o estendere fetch.

### 3. Indici DB (opzionale ma consigliato)
Aggiungere indici trigram per ricerca veloce:
```sql
CREATE INDEX IF NOT EXISTS idx_profiles_search_trgm 
  ON profiles USING gin ((coalesce(nome,'') || ' ' || coalesce(cognome,'') || ' ' || coalesce(email,'') || ' ' || coalesce(telefono,'') || ' ' || coalesce(note,'')) gin_trgm_ops);
```
(richiede `pg_trgm`)

### 4. Esclusione clienti
Filtro hard: `ruolo NOT IN ('cliente')`. Verifico se l'utente vuole escludere anche `prospect` — dal testo dice "tutti TRANNE i clienti" → escludo solo `cliente`.

## File toccati
- `src/components/chat/NuovaConversazioneDialog.tsx` — query estesa
- `src/components/chat/CanaliSidebar.tsx` — filtro client-side esteso
- Nuova migration per indice trigram (opzionale)

## Cosa NON cambia
- Chat Contestuale resta legata a entità (cliente/polizza/sinistro) come oggi
- Ruoli e permessi invariati
- Avatar già integrati nel componente Avatar esistente
