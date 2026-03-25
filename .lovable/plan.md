

## Piano: Gruppi Finanziari con nome + Search nei Select + Dati demo

### Cosa cambia

1. **Aggiungere campo `nome` alla tabella `gruppi_finanziari`** — Sono enti (banche, assicurazioni, enti pubblici) quindi servono: `codice`, `nome` (nome dell'ente), `descrizione`. Migration SQL per aggiungere la colonna.

2. **Aggiornare `SimpleLookupTab` in `TabelleBasePage.tsx`** — Il tab "Gruppi Finanziari" deve diventare un tab custom (come `RamiTab`) con 3 campi: codice, nome, descrizione. Aggiornare anche la tabella per mostrare la colonna Nome.

3. **Seedare dati demo** — Inserire via migration ~8 gruppi finanziari realistici italiani (es. Intesa Sanpaolo, UniCredit, Generali, INPS, Cassa Depositi e Prestiti, etc.).

4. **Aggiungere search/filtro nei Select dropdown** — Creare un componente `SearchableSelect` riutilizzabile (usando `Command` di cmdk/shadcn dentro un `Popover`) e applicarlo a:
   - Select "Gruppo Finanziario" in `ClienteDetail.tsx`
   - Select "Profilo" nei `CodiceCommercialeRow` in `ClienteDetail.tsx`
   - Select "Gruppo Ramo" in `RamiTab` di `TabelleBasePage.tsx`
   - Select "Forma Giuridica" e altri Select nel form di creazione cliente (`ClientiList.tsx`)

5. **Collegamento automatico in creazione cliente** — Aggiungere nel form di creazione cliente (`ClientiList.tsx`) un campo searchable per selezionare il Gruppo Finanziario, salvandolo come `gruppo_finanziario_id` nel payload.

### Modifiche per file

| File | Modifica |
|------|----------|
| **Migration SQL** | `ALTER TABLE gruppi_finanziari ADD COLUMN nome text`. INSERT di ~8 gruppi demo |
| **SearchableSelect.tsx** (nuovo) | Componente riutilizzabile: Popover + Command con input di ricerca + lista filtrata. Props: `options`, `value`, `onValueChange`, `placeholder` |
| **TabelleBasePage.tsx** | Nuovo tab custom `GruppiFinanziariTab` con form a 3 campi (codice, nome, descrizione) e tabella con colonna Nome |
| **ClienteDetail.tsx** | Sostituire i Select di Gruppo Finanziario e Profilo commerciale con `SearchableSelect` |
| **ClientiList.tsx** | Aggiungere campo Gruppo Finanziario (searchable) nel form di creazione cliente. Usare `SearchableSelect` per Forma Giuridica |

### Dettagli tecnici

- Il `SearchableSelect` usa `Popover` + `Command` (gia presenti nel progetto via shadcn) per filtrare le opzioni digitando
- I gruppi finanziari demo includeranno enti reali italiani: banche (Intesa, UniCredit, MPS), assicurazioni (Generali, Allianz), enti pubblici (INPS, INAIL, CDP)
- Il campo `nome` e obbligatorio (`NOT NULL`) con default vuoto per i record esistenti

