## Problema

Sulla pagina **Precontrattuale** (`/portafoglio/doc-precontrattuale`) aperta dalla polizza **325346187 — GENERALI ITALIA SPA**, il prefill non riempie tutto il necessario:

**Cliente**
- Nome/ragione sociale del contraente non è esposto come campo nel form (appare solo nel PDF se la query `prefillData` riesce). Se l'utente cambia il `Cliente (codice)` il nome non si aggiorna nel PDF.
- Nessun fallback: se arrivo da `titoloId` ma `cliente_anagrafica_id` è null, anagrafica vuota.

**Polizza** — molti dati della polizza sono nel DB ma non vengono né letti né stampati:
- `appendice` non prefillato (esiste in `titoli.appendice`)
- `data_decorrenza` (mappata su `garanzia_da` o `durata_da`) non prefillata né stampata
- `data_scadenza` (`titoli.data_scadenza`) non prefillata né stampata
- `frazionamento` (mappato da `titoli.periodicita`) assente
- `premio_lordo` assente
- **Compagnia**: la pagina mostra solo il `codice` dalla seconda query `compagniaData`. Il PDF dovrebbe usare il **nome completo** già disponibile in `titoloData.compagnie.nome` (più affidabile).

## Cosa cambio

### 1. Query titolo arricchita (`DocPrecontrattualePage.tsx`)

Estendo `select` su `titoli` con: `appendice, data_scadenza, garanzia_da, durata_da, periodicita, premio_lordo`.
Estendo join `compagnie` con campi minimi già usati.

### 2. Nuovi state + prefill polizza

Aggiungo state e li popolo nell'`useEffect` su `titoloData`:
- `appendicePol`, `dataDecorrenza` (prendo `garanzia_da` se presente, altrimenti `durata_da`), `dataScadenza`, `frazionamento` (mapping `periodicita` → "Annuale/Semestrale/Trimestrale/Mensile/Unica"), `premioLordo` (formattato €).
- Set `compagniaNome` direttamente da `titoloData.compagnie.nome` (oltre a `codiceCompagnia` per ricerca legacy).

### 3. Campo "Contraente" visibile e governato dallo stato

Aggiungo un input **"Contraente (Nome / Ragione Sociale)"** nella sezione "Contratto Intermediato", popolato:
- da `prefillData.cliente` (priorità: `ragione_sociale` → `cognome nome`)
- editabile manualmente in caso serva.

Lo passo nel PDF come `clienteNomeRagSoc` invece di calcolarlo solo dentro `buildData()`.

### 4. Estendo `PrecontrattualeData` + rendering PDF (`precontrattuale-pdf.ts`)

Aggiungo i campi:
```ts
polizzaAppendice?: string;
polizzaDataDecorrenza?: string;
polizzaDataScadenza?: string;
polizzaFrazionamento?: string;
polizzaPremioLordo?: string;
```

Nel **MUP header** (riga `Cliente / Polizza`) sostituisco la singola riga con una **mini-tabella 2 colonne x 3 righe**:

```text
+----------------------------+----------------------------+
| Cliente: [nome]            | Polizza: [nr]   App: [..]  |
+----------------------------+----------------------------+
| CF: [..]  P.IVA: [..]      | Compagnia: [nome]          |
+----------------------------+----------------------------+
| Indirizzo: [..]            | Decorrenza: [..]  Scad: [..]|
|                            | Ramo: [..]  Frazion: [..]  |
|                            | Premio lordo: € [..]       |
+----------------------------+----------------------------+
```

Mantengo lo stile esistente (font, colori, bordi sottili) — nessun restyle, solo righe in più.

### 5. Compagnia nel testo c) della Sezione IV

Sostituisco fallback `compagniaData?.nome` con `titoloData?.compagnie?.nome` se presente — più stabile.

## File coinvolti

- `src/pages/DocPrecontrattualePage.tsx` (query, state, useEffect prefill, nuovo input Contraente, passaggio campi a `buildData`)
- `src/lib/precontrattuale-pdf.ts` (interfaccia `PrecontrattualeData`, header MUP)

## Cosa NON cambio

- Layout grafico generale del PDF, font, colori, sezioni testuali I/II/III/IV.
- Logica intermediario RUI (Specialist + Sede), già funzionante.
- Salvataggio in Archivio Documentale.
- Bottoni Anteprima/Stampa/Salva.

## Test

Aprirò la pagina sulla polizza 325346187, genererò anteprima e verificherò che compaiano nome contraente, appendice, decorrenza/scadenza, frazionamento, premio, compagnia "GENERALI ITALIA SPA".