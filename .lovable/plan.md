## Diagnosi

Il sinistro **SIN-2026-2403** è correttamente salvato in DB con `cliente_anagrafica_id = 94dc...` (Comune di Varese) e `ufficio_id = 327e92f7...`. Il problema **non è il dato**, è il **componente che lo legge**:

```ts
// src/components/SinistriClienteTab.tsx (riga 35)
.select("*, agenzie(nome), titoli(numero_titolo)")
```

`agenzie` non è una relazione di `sinistri` → la query ritorna errore PostgREST → fallback array vuoto → "Nessun sinistro collegato a questo cliente". Inoltre la mappa stati (`statoBadge`) e le label tipo non includono i nuovi valori (`in_valutazione`, `in_liquidazione`, e i 27 nuovi tipi di sinistro).

Inoltre `SinistroDetail.tsx` ha grafica disallineata rispetto al resto del gestionale (h1 "nudo", card grigie semplici, niente header colorato con icona, niente link al cliente, tipi mostrati con vecchia mappa hard-coded, Select stato senza guardia per ruolo).

## Cosa farò

### 1. Bug fix: tab Sinistri nel cliente (Varese vede il suo SIN)
File: `src/components/SinistriClienteTab.tsx`
- Sostituire `agenzie(nome)` → `compagnie(nome)` nella `select`.
- Allineare `statoBadge` ai 7 stati (`in_valutazione` ambra, `in_liquidazione` viola, ecc.).
- Usare `getTipoSinistroLabel` da `src/lib/tipiSinistro.ts` invece della mappa locale `tipoLabels`.
- Aggiungere colonna "Luogo" e badge ramo, allineare stile tabella zebrata come altre liste (memory).

### 2. Restyling `SinistroDetail.tsx` coerente con il design system
- Header pagina in stile `ClienteDetail` / `ClientePolizzaDetail`: icona rotonda colorata (arancio per sinistri come in `ClienteSinistri`), titolo + sottotitolo, badge stato grosso a destra, breadcrumb Back.
- **Link cliente cliccabile** → `/archivi/clienti/{cliente_anagrafica_id}` con nome + tipo (Ente/Privato/Azienda).
- **Link polizza** → `/portafoglio/titoli/{titolo_id}` se presente.
- KPI cards finanziarie in un'unica griglia con border-left colorato (pattern di `ClienteSinistri`) per uniformità font/colori (font default progetto, niente `text-2xl font-bold` slegato).
- Rimuovere mappa `tipoLabels` interna, usare `getTipoSinistroLabel`.
- Sezione "Luogo sinistro" con icona MapPin + indirizzo strutturato (via, CAP, città, prov.).

### 3. Gestione stati pratica (admin / specialist / manager)
- La card "Cambia Stato" diventa visibile solo se `isAdmin || hasPermission('sinistri')` (esclude cliente/produttore L5/L6).
- Sostituire i bottoni piatti con un `Select` SearchableSelect-style + bottone "Aggiorna" + textarea "Note cambio stato" opzionale (passata all'edge function `gestione-sinistri` già pronta che logga in `sinistro_eventi` + `log_attivita`).
- Aggiungere assegnazione **Responsabile** e **Liquidatore** (in-place edit con `SearchableSelect` sui profiles dell'ufficio) — anch'essa role-gated e loggata via `logAttivita`.

### 4. Documenti & coerenza struttura
- Il tab "Documenti" già usa `DocumentiTab entitaTipo="sinistro" bucketName="documenti_sinistri"`: aggiungo solo filtri categoria (`perizia`, `referto_medico`, `denuncia`, `corrispondenza`, `liquidazione`).
- Tab "Polizza collegata" nuovo: card riassuntiva con numero, compagnia, ramo, scadenza, link a TitoloDetail.

### 5. SinistriList (vista admin)
- Allineare colonne / badge stati con i 7 nuovi valori e con `getTipoSinistroLabel`.
- Filtro stato esteso (`in_valutazione`, `in_liquidazione`).
- Click riga → SinistroDetail (già presente).

### Nessuna modifica DB
Lo schema (`sinistri`, `sinistro_eventi`, `documenti`, `log_attivita`) è già a posto dopo le migration precedenti. Nessuna nuova migration in questo passo.

## File modificati
- `src/components/SinistriClienteTab.tsx` (bug + restyle)
- `src/pages/SinistroDetail.tsx` (restyle completo + guardia ruoli + assegnazioni)
- `src/pages/SinistriList.tsx` (badge/tipi allineati)
