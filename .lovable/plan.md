# Salva automaticamente il PDF caricato in AI tra i documenti della polizza

## Problema
Oggi quando importi una polizza con "Scansione AI Polizza" (PDF), il file viene mandato a Gemini per l'estrazione ma **non viene archiviato**. Dopo la creazione del titolo, nella tab Documenti della polizza non c'è traccia del PDF originale.

## Comportamento target
Al `Conferma` della polizza creata da AI: il PDF originale viene caricato automaticamente nel bucket `documenti_titoli` e registrato in `documenti` legato al nuovo `titolo_id`, così appare subito nella tab Documenti della polizza con categoria `polizza_originale`.

## Modifiche

### 1) `src/components/polizze/ImportNuovaPolizzaAIDialog.tsx`
- Conservare in stato il PDF caricato (`pdfBase64`, `pdfMime`, `pdfName`) — oggi `b64` è una variabile locale dentro `handleFile` e viene perso.
- Estendere il type `MatchResult` con `sourcePdf?: { name: string; base64: string; mimeType: string }`.
- In `buildResult()` (e nell'altra costruzione di `MatchResult` a riga 539) includere `sourcePdf` se presente.
- Su `reset()` ripulire anche i campi PDF.

### 2) `src/pages/ImmissionePolizzaPage.tsx`
- Aggiungere stato `aiSourcePdf` (stesso shape).
- In `handleAIImportApply(m)`: salvare `m.sourcePdf` in `aiSourcePdf` (oltre a quanto già fa con i dati).
- Nel salvataggio (subito dopo l'`insert` su `titoli` che restituisce `newTitolo.id`, prima del `toast.success`), se `aiSourcePdf` è presente:
  1. Decodificare base64 → `Uint8Array`.
  2. `supabase.storage.from("documenti_titoli").upload("${newTitolo.id}/${nomeFile}", bytes, { contentType, upsert: true })`.
  3. `supabase.from("documenti").insert({ entita_tipo: "titolo", entita_id: newTitolo.id, bucket_name: "documenti_titoli", path_storage, nome_file, categoria: "polizza_originale", visibile_al_cliente: false })`.
  4. Eventuali errori → `toast.warning` ma non bloccare la creazione polizza.
- Nome file: usare quello originale, normalizzato (spazi → `_`); fallback `polizza-${numero}.pdf`.

### 3) Nessuna migration
Il bucket `documenti_titoli` e la tabella `documenti` esistono già (stesso pattern usato in `seed-comune-varese-polizze` e nella tab Documenti delle polizze).

## Fuori scope
- Flusso "Importa polizza esistente" (`ImportPolizzaAiButton`) — solo se richiesto in seguito.
- Cambi di UI nella tab Documenti.
