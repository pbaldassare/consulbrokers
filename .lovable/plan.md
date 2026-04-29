## Obiettivo

Classificare ogni **Gruppo Finanziario** come `privato`, `azienda` o `ente`. Questo flag governerà in futuro quali campi mostrare/nascondere nell'anagrafica cliente quando si seleziona quel gruppo.

## Modifiche Database (migration)

Tabella `gruppi_finanziari`:
- Aggiungo colonna `tipo_soggetto text NOT NULL DEFAULT 'azienda'`
- Aggiungo CHECK constraint: valori ammessi `'privato' | 'azienda' | 'ente'`
- Pre-popolo i record esistenti con valori coerenti analizzando il codice/nome:
  - `LINEA_PERS`, `GF02` → `privato`
  - `EP_*`, `EPE`, `ENTE_AUT`, `IPAB`, `AZ_PART_PUB`, `AZ_SAN_PUB` → `ente`
  - tutti gli altri (ASD, ASS_*, AZ_PRIV, AZ_SAN_PRIV, FARMAC, GF01/03/04/05, ecc.) → `azienda`

## Modifiche UI — `src/pages/TabelleBasePage.tsx` (tab Gruppi Finanziari)

**Tabella:**
- Nuova colonna **Tipo** tra "Descrizione" e "Attivo", con badge colorato:
  - `privato` → badge blu
  - `azienda` → badge teal (brand)
  - `ente` → badge ambra

**Dialog Nuovo/Modifica:**
- Nuovo campo **Tipo Soggetto** come gruppo di 3 RadioGroup (Privato / Azienda / Ente) con icone (`User`, `Building2`, `Landmark` da lucide-react)
- Default su `azienda` per nuovi record
- Salvataggio del valore in INSERT/UPDATE

**Stato locale:** aggiungo `tipoSoggetto` agli `useState`, reset in `openNew`, valorizzazione in `openEdit`, invio in `save.mutate`.

## Cosa NON faccio in questo step

Non tocco ancora `ClienteDetail.tsx` / `ImmissionePolizzaPage.tsx`: il flag viene solo introdotto e gestito qui. La logica di "campi dinamici nell'anagrafica cliente in base al tipo del gruppo finanziario selezionato" sarà uno step successivo (quando dirai quali campi mostrare per privato vs azienda vs ente).

## File toccati

- **Nuova migration**: `supabase/migrations/<timestamp>_gruppi_finanziari_tipo_soggetto.sql`
- **Edit**: `src/pages/TabelleBasePage.tsx` (sezione `GruppiFinanziariTab`)
- **Auto-rigenerato**: `src/integrations/supabase/types.ts`
