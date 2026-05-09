## Obiettivo
Riorganizzare il portale cliente: rinominare la voce "Documenti" in "Documentazione Ente" mostrando solo i documenti dell'ente (anagrafica cliente), e riordinare le voci della sidebar.

## 1. Riordino sidebar (`src/components/ClienteLayout.tsx`)

Nuovo ordine voci `allNavItems`:
1. Dashboard
2. Polizze
3. Scadenziario (rinominato da "Scadenze", path invariato `/cliente/scadenze`)
4. Sinistri
5. Chat
6. Documentazione Ente (rinominato da "Documenti", path invariato `/cliente/documenti`)
7. Notifiche
8. Dati Ente
9. Info e Contatti

## 2. Pagina Documentazione Ente (`src/pages/cliente/ClienteDocumenti.tsx`)

Riscrittura per mostrare **solo i documenti collegati all'ente** (entita_tipo='cliente'):

- Titolo: "Documentazione Ente"
- Query: `documenti.select('*').eq('entita_tipo','cliente').in('entita_id', myIds)` ordinata per `created_at desc`
- Filtri rimasti:
  - Ricerca testuale (nome file / categoria)
  - Filtro per **Tipologia** (categoria) — popolato dinamicamente
  - Rimosso il filtro "Entità" (non serve, tutto è dell'ente)
- Card lista con stesso layout zebra esistente, mostrando nome file, categoria, data, badge "Caricato da te"
- Azioni per riga: Anteprima (Eye), Scarica (Download), **Elimina con AlertDialog di conferma** (già presente, mantenuto; l'utente può eliminare solo i propri caricamenti — `caricato_da_cliente=true`)
- Pulsante "Carica documento" in alto: apre `UploadDocClienteDialog` con `fixedEntita={ tipo: "cliente", id: clienteId }` per forzare upload sull'ente nel bucket `documenti_clienti`
- Rimosso enrichment polizze/sinistri (non più necessario)

## 3. Bucket storage

Verificato: il bucket `documenti_clienti` esiste già (privato) con policy RLS corrette per cliente (SELECT/INSERT/DELETE basate su `caricato_da` / `visibile_al_cliente`). **Nessuna migrazione necessaria.**

## 4. File modificati

- `src/components/ClienteLayout.tsx` — riordino + rinomina label
- `src/pages/cliente/ClienteDocumenti.tsx` — riscrittura per soli documenti ente

## Fuori scope

- Nessuna modifica al backend, schema o policy.
- Nessuna rinomina di route (i path restano `/cliente/documenti` e `/cliente/scadenze` per non rompere link esistenti).
- Nessuna modifica al dialog di upload (già supporta `fixedEntita`).
