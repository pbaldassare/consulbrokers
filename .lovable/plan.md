## Obiettivo
Nel PDF E/C Cliente (e in TitoloDetail) la colonna/campo "Compagnia" deve mostrare il **gruppo compagnia** (es. `CATTOLICA`) e non l'agenzia (es. `Agenzia Generale di CAMPOBASSO`).

Su DB: `titoli.compagnia_id → compagnie` (tipo `agenzia`) → `gruppo_compagnia_id → gruppi_compagnia.descrizione` (con fallback al testo `compagnie.gruppo_compagnia`, poi `compagnie.nome`).

## Modifiche

### 1. `src/pages/contabilita/ECClientePdfPage.tsx`
- Estendere la select dei titoli:
  ```
  compagnie:compagnia_id(nome, gruppo_compagnia, gruppi_compagnia:gruppo_compagnia_id(descrizione))
  ```
- Mapping riga PDF:
  ```ts
  compagnia: t.compagnie?.gruppi_compagnia?.descrizione
          || t.compagnie?.gruppo_compagnia
          || t.compagnie?.nome
          || ""
  ```

### 2. `src/pages/TitoloDetail.tsx`
- Estendere la select del titolo: aggiungere `gruppo_compagnia, gruppi_compagnia:gruppo_compagnia_id(descrizione)` dentro `compagnia_diretta:compagnie!titoli_compagnia_id_fkey(...)`.
- Nella sezione Contratto aggiungere un nuovo `FieldRow` **"Compagnia"** (prima della riga "Agenzia / Agenzia di rif.") che mostri:
  ```
  (t.compagnia_diretta?.gruppi_compagnia?.descrizione)
    || (t.compagnia_diretta?.gruppo_compagnia)
    || "—"
  ```
- La riga "Agenzia / Agenzia di rif." resta invariata (mostra l'agenzia reale, che è il rapporto).

## Fuori scope
- Nessuna modifica a `ec-cliente-pdf.ts` (la colonna `Compagnia` esiste già).
- Nessuna migration DB.
- Altre pagine (E/C Agenzia, Storico ecc.) non toccate in questo intervento.
