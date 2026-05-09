# Filtri portale cliente + upload documenti su polizza

## 1. `/cliente/scadenze` — filtri e drill-down

Aggiungo una barra filtri sopra la lista:
- **Finestra scadenza**: Tutte / Entro 30 gg / Entro 60 gg / Entro 90 gg / Range date personalizzato (da–a, con `DatePicker`).
- **Ramo / tipologia polizza**: `SearchableSelect` popolato dai rami effettivamente presenti nelle polizze del cliente (es. RC Auto, Incendio, RC Inquinamento…). Multi-select.
- **Compagnia**: `SearchableSelect` popolato dalle compagnie presenti.
- **Ricerca testuale**: numero polizza / targa.
- Pulsante **Reset filtri**.

Le KPI "Entro 30/60/90" si ricalcolano sui risultati filtrati.

Ogni card scadenza diventa cliccabile e porta a **`/cliente/polizze/:id`** (la pagina dettaglio già esiste, `ClientePolizzaDetail.tsx`). Aggiungo cursor-pointer + hover.

> Nota: la pagina mostra **scadenze polizze**, non sinistri. Interpreto "tipologia di sinistro" come "tipologia/ramo della polizza in scadenza". Se invece serve un filtro sui sinistri aperti, lo aggiungo in `/cliente/sinistri` (fammelo sapere).

## 2. `/cliente/polizze` — filtri elenco

Barra filtri sopra la tabella (stesso stile teal):
- **Stato**: Tutti / Attivo / Sospeso / Scaduto / Incassato.
- **Ramo**: `SearchableSelect` multi.
- **Compagnia**: `SearchableSelect` multi.
- **Scadenza da/a**: due `DatePicker`.
- **Ricerca testuale**: numero polizza / targa / prodotto.
- Pulsante **Reset**.

Il totale "Premio Annuo Lordo" in footer si aggiorna sui risultati filtrati. Conteggio "N polizze trovate" anch'esso dinamico.

## 3. `/cliente/polizze/:id` — upload documenti tracciato

Nella card "Documenti allegati" del dettaglio polizza:

- Nuovo pulsante **"Carica documento"** → apre `UploadDocPolizzaDialog` (nuovo componente in `src/components/cliente/`).
- Dialog con:
  - **File** (drag&drop o file picker, max 20MB, PDF/JPG/PNG).
  - **Tipologia documento**: select con valori (Quietanza, Appendice, Comunicazione compagnia, Documento identità, Libretto, Verbale, Perizia, Altro). Salvato in `documenti.tipo_documento` (campo già usato nel sistema).
  - **Descrizione** (textarea opzionale).
  - **Data documento** (DatePicker opzionale).
- Upload reale su bucket **`documenti_titoli`** (path `{cliente_id}/{titolo_id}/{uuid}-{filename}`).
- Insert in tabella **`documenti`** con: `entita_tipo='titolo'`, `entita_id=titolo.id`, `cliente_anagrafica_id`, `bucket_name='documenti_titoli'`, `path_storage`, `nome_file`, `mime_type`, `dimensione_bytes`, `tipo_documento`, `descrizione`, `data_documento`, `caricato_da_cliente=true`, `visibile_al_cliente=true`, `caricato_da=user.id`.
- Lista documenti aggiornata in realtime (refetch dopo insert) con badge **"Caricato da te"** sui doc con `caricato_da_cliente=true`, accanto a tipo_documento e data caricamento.
- Download tramite `createSignedUrl` (già implementato).

## 4. RLS / DB

Le policy esistenti già consentono:
- `documenti` insert per cliente su `entita_tipo='titolo'` + propria polizza.
- `storage.objects` insert su `documenti_titoli` per path che inizia col proprio `cliente_id`.

Verifica rapida che le policy coprano il path scelto; se manca solo il pattern path (es. `{titolo_id}/...` senza `{cliente_id}/` davanti), allineo il path al pattern già autorizzato. **Nessuna nuova migration** prevista, salvo gap rilevati in fase di test.

## 5. File toccati / nuovi

**Modificati**
- `src/pages/cliente/ClienteScadenze.tsx` — barra filtri + drill-down link.
- `src/pages/cliente/ClientePolizze.tsx` — barra filtri + totali dinamici.
- `src/pages/cliente/ClientePolizzaDetail.tsx` — pulsante "Carica documento", badge tipo + "Caricato da te".

**Nuovi**
- `src/components/cliente/UploadDocPolizzaDialog.tsx` — dialog upload tracciato.

## Fuori scope
- Modifica/cancellazione documenti caricati dal cliente (solo upload + view).
- Filtri avanzati su `/cliente/sinistri` (separato, da confermare).
- Cambio struttura bucket o nuove policy massive.
