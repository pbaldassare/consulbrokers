

## Piano: Import Provvigioni da PDF con IA

### Obiettivo

Nuovo tab "Import Provvigioni IA" nella pagina Compagnie, accanto ad "Anagrafica Compagnia" e "Compagnie Sinistri". Permette di caricare un PDF con le provvigioni di una compagnia e usare l'IA per estrarre automaticamente le categorie/rami e le relative percentuali, confrontarle con quelle esistenti in DB, e salvarle.

### Flusso utente

1. Selezionare una compagnia dall'elenco esistente
2. Caricare un PDF con la tabella provvigioni
3. L'IA estrae le righe: nome categoria + percentuale provvigione
4. Il sistema confronta ogni categoria estratta con `categorie_prodotto` esistenti:
   - **Match esatto** → mostra la riga pronta per il salvataggio
   - **Match simile** (es. "Difesa Legale" vs "Tutela Legale") → propone l'armonizzazione con possibilita di scegliere la categoria esistente o crearne una nuova
   - **Nessun match** → propone di creare una nuova categoria (con possibilita di rinominarla)
5. L'utente valida/modifica ogni riga e salva tutto in `provvigioni_compagnia_ramo` (e crea le nuove categorie in `categorie_prodotto`)

### Implementazione

**1. Nuova Edge Function `supabase/functions/parse-provvigioni-pdf/index.ts`**
- Riceve il PDF in base64
- Riceve la lista delle categorie esistenti dal client
- Usa Lovable AI (Gemini) con tool calling per estrarre strutturalmente: `[{nome_categoria, percentuale}]`
- Per ogni categoria estratta, calcola la similarita con le categorie esistenti e restituisce: `{nome_originale, percentuale, match_esatto: string|null, match_simili: [{id, nome, score}], suggerimento: "usa_esistente"|"crea_nuova"}`

**2. Nuovo tab in `src/pages/CompagnieList.tsx`**
- `<TabsTrigger value="import-provvigioni">Import Provvigioni IA</TabsTrigger>`
- Componente `ImportProvvigioniTab` con:
  - SearchableSelect per scegliere la compagnia
  - Input file per il PDF
  - Bottone "Analizza con IA"
  - Tabella risultati con colonne: Categoria (dal PDF) | Azione | Categoria DB | % Provvigione | Stato
  - Per ogni riga, dropdown per scegliere: "Usa esistente", "Crea nuova", "Rinomina e crea"
  - Campo editabile per rinominare la nuova categoria
  - Bottone "Salva Tutto" che:
    - Crea le nuove categorie in `categorie_prodotto`
    - Inserisce/aggiorna le righe in `provvigioni_compagnia_ramo`

**3. Logica di matching (lato edge function)**
- Confronto case-insensitive + normalizzazione (trim, lowercase)
- Similarita fuzzy (Levenshtein o inclusione parziale) per trovare match simili con score > 0.6
- L'IA stessa puo suggerire i mapping quando i nomi sono semanticamente simili

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| Edge function | `parse-provvigioni-pdf` — riceve `{pdf_base64, categorie_esistenti: [{id, nome}]}` |
| Modello IA | `google/gemini-2.5-flash` (buon bilanciamento costo/qualita per OCR+estrazione) |
| Tabelle coinvolte | `categorie_prodotto` (lettura + insert nuove), `provvigioni_compagnia_ramo` (insert/upsert), `compagnie` (lettura per select) |
| Nessuna migrazione DB | Tutto usa tabelle esistenti |

