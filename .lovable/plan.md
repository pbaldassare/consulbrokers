

## Piano: Gestione Appendici Polizza con creazione testo e allegati

### Cosa si costruisce
Una funzionalità completa per creare appendici assicurative collegate a una polizza. L'appendice può contenere un testo redatto direttamente (editor) oppure un documento allegato (upload file), o entrambi. Ogni appendice viene catalogata e collegata al titolo/polizza.

### 1. Nuova tabella `appendici_polizza` (migrazione SQL)

```sql
CREATE TABLE appendici_polizza (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo_id uuid NOT NULL REFERENCES titoli(id) ON DELETE CASCADE,
  numero_appendice text NOT NULL,
  data_appendice date DEFAULT CURRENT_DATE,
  data_effetto date,
  oggetto text,                    -- titolo/oggetto breve
  testo text,                      -- contenuto testuale redatto dall'utente
  tipo text DEFAULT 'modifica',    -- modifica, integrazione, rettifica, ecc.
  file_path text,                  -- path nel bucket storage (se allegato)
  nome_file text,                  -- nome originale del file allegato
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE appendici_polizza ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON appendici_polizza
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### 2. Riscrittura `AppendiciPolizzaPage.tsx`

La pagina attuale (form generico) viene ristrutturata in due sezioni:

**Sezione superiore** — Info polizza (pre-compilate da query params, read-only):
- Cliente, Numero Polizza, Riga (già implementati)

**Sezione centrale** — Nuova appendice:
- Numero appendice (auto-incremento suggerito)
- Data appendice, Data effetto
- Oggetto (campo testo breve)
- Tipo (select: Modifica, Integrazione, Rettifica, Annullamento parziale)
- **Tab "Scrivi testo"**: Textarea per redigere il contenuto dell'appendice
- **Tab "Allega documento"**: Upload file (PDF, DOC, immagini) nel bucket `documenti_titoli`
- Note aggiuntive

**Azione "Salva"**: inserisce record in `appendici_polizza` + eventuale upload file in storage.

**Sezione inferiore** — Lista appendici esistenti per quel titolo:
- Tabella con numero, data, oggetto, tipo, file allegato (link download), azioni (visualizza testo, elimina)

### 3. Integrazione nel `TitoloDetail.tsx`

Aggiungere un tab o una sezione "Appendici" nel dettaglio polizza che mostra la lista delle appendici create, con link per crearne di nuove.

### File coinvolti
- **Nuova migrazione SQL** — tabella `appendici_polizza` + RLS
- **`src/pages/AppendiciPolizzaPage.tsx`** — riscrittura completa con form + lista
- **`src/pages/TitoloDetail.tsx`** — aggiunta sezione/tab appendici collegate

