# Refactor area cliente: documenti CRUD + sidebar pulita

## 1. `/cliente/documenti` — gestione completa documenti

Trasformo la pagina (oggi solo lista read-only senza filtro per cliente) in un vero gestore documentale con upload, visualizzazione e cancellazione.

- **Filtro per cliente**: query limitata via `get_my_cliente_ids()` su `documenti` con `entita_tipo IN ('cliente','titolo','sinistro')` legati alle proprie entità (oggi mostra `*`, con RLS comunque ristretta ma senza filtro lato query).
- **Pulsante "Carica documento"** in alto a destra → riusa `UploadDocPolizzaDialog` generalizzato in `UploadDocClienteDialog` con scelta dell'entità target:
  - **Generale (anagrafica ente)** → bucket `documenti_clienti`, `entita_tipo='cliente'`.
  - **Su una polizza** → select polizza + bucket `documenti_titoli`, `entita_tipo='titolo'`.
  - **Su un sinistro** → select sinistro + bucket `documenti_sinistri`, `entita_tipo='sinistro'`.
  - Tipologia documento + file PDF/JPG/PNG (max 20MB).
- **Visualizzazione inline**: pulsante anteprima (icona occhio) che apre il file in un dialog (PDF in `<iframe>` da signed URL, immagini in `<img>`).
- **Download**: già presente, mantenuto.
- **Eliminazione**: pulsante cestino solo per documenti con `caricato_da_cliente=true` (gli unici che il cliente può rimuovere via RLS). Conferma dialog. Cancella sia la riga `documenti` sia il file dallo storage.
- **Lista migliorata**: ogni riga mostra nome file, badge tipologia (`categoria`), badge entità (Polizza N°/Sinistro N°/Generale), data, badge "Caricato da te". Raggruppamento opzionale per entità (toggle).
- **Filtri**: ricerca testuale + filtro per entità (Tutti/Generali/Polizze/Sinistri) + filtro tipologia.

## 2. `/cliente/polizze/:id` — stesso comportamento sui documenti

Nel pannello "Documenti allegati" del dettaglio polizza:
- Mantengo upload (già fatto).
- Aggiungo **anteprima inline** (stessa logica dei documenti).
- Aggiungo **eliminazione** per i doc con `caricato_da_cliente=true` (con conferma).

## 3. RLS / DB

Verifico le policy `documenti` per DELETE:
- Se manca `cliente_delete_own_documenti` (cancellazione solo per `caricato_da_cliente=true` su entità del cliente), aggiungo policy.
- Storage `documenti_clienti`/`documenti_titoli`/`documenti_sinistri`: aggiungo policy DELETE per cliente sui propri file (path che inizia con `{cliente_id}/`), se mancante.

Una **migration** dedicata aggiunge solo le policy DELETE mancanti, nessun cambio struttura.

## 4. Sidebar `/cliente`

In `src/components/ClienteLayout.tsx`:
- Rinomino **"I Miei Dati" → "Dati Ente"** (icona `Building2`).
- Rinomino **"Il Mio Ufficio" → "Info e Contatti"** (icona `Phone` o `Info`).
- **Rimuovo** la voce **"Carica Doc"** (`/cliente/upload`) dalla sidebar — l'upload si fa direttamente dalla pagina Documenti / dettaglio Polizza / dettaglio Sinistro. La rotta `/cliente/upload` resta accessibile ma nascosta (oppure la rimuovo del tutto: confermo rimozione completa).

## 5. Pagina `/cliente/anagrafica` (header)

Aggiorno solo titolo H1 da "I Miei Dati" → **"Dati Ente"** per coerenza con la sidebar (resta la card "Anagrafica" interna).

## 6. File toccati / nuovi

**Modificati**
- `src/components/ClienteLayout.tsx` — rename voci, rimozione "Carica Doc".
- `src/pages/cliente/ClienteDocumenti.tsx` — refactor completo CRUD + filtri + anteprima.
- `src/pages/cliente/ClientePolizzaDetail.tsx` — anteprima + delete sui doc cliente.
- `src/pages/cliente/ClienteAnagrafica.tsx` — titolo "Dati Ente".
- `src/pages/cliente/ClienteUfficio.tsx` — titolo "Info e Contatti".

**Nuovi**
- `src/components/cliente/UploadDocClienteDialog.tsx` — dialog upload generico (entità: cliente/polizza/sinistro).
- `src/components/cliente/DocPreviewDialog.tsx` — anteprima inline PDF/immagini.
- Migration RLS: policy DELETE su `documenti` + `storage.objects` per i 3 bucket cliente.

## Fuori scope
- Versioning documenti.
- Cartelle/folder gerarchici cliente-side.
- Sostituzione del documento (delete+upload manuale come oggi).
