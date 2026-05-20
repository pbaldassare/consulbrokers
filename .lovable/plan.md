## Obiettivo
Per ogni **rapporto lavorativo** (riga di `compagnia_rapporti` — broker, agenzia, plurimandataria, ecc.) avere un **folder documentale dedicato** dove caricare, rinominare, scaricare ed eliminare file, con popup di conferma sull'eliminazione.

## Dove vive nell'UI
Dentro `RapportiCompagniaDialog.tsx`, accanto a ciascuna riga della tabella rapporti aggiungo un'azione **"Documenti"** (icona cartella) che apre un secondo dialog `RapportoDocumentiDialog` dedicato a quel singolo rapporto.

Il dialog mostra:
- Header: nome rapporto + tipo + compagnia madre
- Pulsante **Carica documento** (input file nascosto, multi-file)
- Select **Tipo documento** (mandato, lettera incarico, convenzione, polizza quadro, altro)
- Tabella documenti: Nome · Tipo · Caricato da · Data · Azioni (Download / Rinomina / Elimina)
- **Rinomina**: input inline che cambia solo `nome_file` (il `file_path` su storage resta invariato)
- **Elimina**: `AlertDialog` shadcn con "Sei sicuro? L'azione è irreversibile" → conferma → rimuove sia da storage che da DB

## Backend (richiede migrazione)
Nuova tabella `compagnia_rapporto_documenti`:
- `rapporto_id` → FK `compagnia_rapporti(id)` ON DELETE CASCADE
- `nome_file` (text, rinominabile)
- `file_path` (text, path su storage, immutabile)
- `tipo_documento` (text: mandato/convenzione/lettera/polizza_quadro/altro)
- `dimensione_bytes`, `mime_type`
- `uploaded_by` → FK `profiles(id)`
- RLS: lettura/scrittura per utenti autenticati interni (stesso pattern di `trattativa_documenti`)

Storage: riuso del bucket esistente **`documenti_generali`**, path: `compagnia_rapporti/{rapporto_id}/{timestamp}_{nome}`.

## Componenti da creare
- `src/components/compagnie/RapportoDocumentiDialog.tsx` — dialog principale (pattern identico a `TrattativaDocumentiTab.tsx` già in uso, adattato a dialog invece di tab)
- Estensione di `RapportiCompagniaDialog.tsx`: nuova colonna/azione "Documenti" con icona `FolderOpen` che apre il dialog passando `rapportoId`

## Dettagli tecnici
- Download: `supabase.storage.from('documenti_generali').createSignedUrl(path, 300)`
- Rinomina: UPDATE solo su `nome_file` (no rename storage, non necessario)
- Eliminazione: prima `storage.remove([path])` poi `delete` dalla tabella, dentro stessa mutation; popup conferma con `AlertDialog`
- Toast feedback (sonner) per ogni operazione

## Fuori scopo
- Versioning documenti
- Anteprima PDF inline (basta download)
- Cartelle/sottocartelle (folder unico per rapporto)
