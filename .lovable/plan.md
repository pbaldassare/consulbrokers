

## Piano: Integrazione AI per lettura documenti (OCR)

### Obiettivo
Aggiungere la possibilita di caricare documenti (carta d'identita, tessera sanitaria, visure camerali, copie polizze) e usare l'AI (Gemini via Lovable AI Gateway) per estrarre automaticamente i dati e compilare i campi dei form.

### Dove serve

| Contesto | Documento | Campi estratti |
|----------|-----------|----------------|
| Clienti Privati - nuovo/modifica | Carta d'Identita | nome, cognome, codice_fiscale, data_nascita, luogo_nascita, indirizzo_residenza, cap, citta, provincia |
| Clienti Privati - nuovo/modifica | Tessera Sanitaria | codice_fiscale, nome, cognome, data_nascita |
| Clienti Azienda - nuovo/modifica | Visura Camerale | ragione_sociale, partita_iva, codice_fiscale_azienda, forma_giuridica, indirizzo_sede, cap_sede, citta_sede, provincia_sede, codice_sdi, pec |
| Immissione Polizza | Copia Polizza | numero_polizza, codice_cliente, compagnia, prodotto, premio |
| Prospect | Documento identita | nome, cognome, email, telefono |

### Componenti da creare

**1. Edge Function `extract-document-data`** (`supabase/functions/extract-document-data/index.ts`)
- Riceve: file base64 + tipo_documento (carta_identita / tessera_sanitaria / visura_camerale / copia_polizza)
- Usa Lovable AI Gateway con Gemini 2.5 Flash (multimodale) - stesso pattern gia usato in `parse-bank-document`
- Tool calling per output strutturato con schema diverso per ogni tipo_documento
- Restituisce JSON con i campi estratti

**2. Componente `AiDocumentScanner.tsx`** (`src/components/AiDocumentScanner.tsx`)
- Pulsante con icona scanner/camera
- Al click apre area drag-and-drop per caricare immagine/PDF
- Mostra spinner durante l'elaborazione
- Chiama l'edge function e restituisce i dati estratti via callback `onExtracted(data)`
- Accetta prop `documentType` per sapere quale schema usare
- Accetta `accept` per filtrare tipi file (immagini + PDF)

**3. Integrazione in `ClientiList.tsx`**
- Nel dialog "Nuovo Cliente", aggiungere il componente `AiDocumentScanner` con due opzioni:
  - Per Privati: "Scansiona Carta d'Identita" e "Scansiona Tessera Sanitaria"
  - Per Aziende: "Scansiona Visura Camerale"
- Al completamento dell'estrazione, i campi del form vengono compilati automaticamente (l'utente puo correggerli prima di salvare)

**4. Integrazione in `ImmissionePolizzaPage.tsx`**
- Aggiungere pulsante "Scansiona Polizza" nel fieldset Polizza
- Estrae: numero polizza, dati cliente, compagnia, prodotto, premio

**5. Integrazione in `ProspectDetail.tsx` / `ProspectList.tsx`**
- Aggiungere scanner nel form di creazione prospect per estrarre dati dal documento d'identita

### Dettagli tecnici

- L'edge function usa tool calling (come `parse-bank-document`) per output strutturato
- Schema per carta d'identita:
```text
{ nome, cognome, codice_fiscale, data_nascita, luogo_nascita,
  indirizzo, cap, citta, provincia, numero_documento, scadenza_documento }
```
- Schema per visura camerale:
```text
{ ragione_sociale, partita_iva, codice_fiscale, forma_giuridica,
  indirizzo_sede, cap, citta, provincia, pec, codice_sdi, 
  rappresentante_legale, data_iscrizione }
```
- Schema per copia polizza:
```text
{ numero_polizza, compagnia, prodotto, contraente, 
  codice_fiscale_contraente, premio_annuo, data_effetto, data_scadenza }
```
- Il componente AiDocumentScanner e riusabile ovunque con prop `documentType` e callback `onExtracted`
- File accettati: JPG, PNG, WEBP, PDF (max 10MB)
- Aggiornare `supabase/config.toml` con la nuova function

### File coinvolti

| Azione | File |
|--------|------|
| Creare | `supabase/functions/extract-document-data/index.ts` |
| Creare | `src/components/AiDocumentScanner.tsx` |
| Modificare | `src/pages/ClientiList.tsx` |
| Modificare | `src/pages/ImmissionePolizzaPage.tsx` |
| Modificare | `src/pages/ProspectDetail.tsx` |
| Modificare | `supabase/config.toml` |

