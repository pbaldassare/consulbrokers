

## Piano: Provvigioni a livello Compagnia + Ramo

### Concetto

Spostare le provvigioni dal livello "prodotto" al livello **Compagnia + Ramo (categoria)**. Una sola percentuale per combinazione compagnia-ramo. I prodotti restano come catalogo testuale ma senza provvigione propria.

### Interventi

**1. Nuova tabella `provvigioni_compagnia_ramo`**

```sql
CREATE TABLE provvigioni_compagnia_ramo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compagnia_id uuid NOT NULL REFERENCES compagnie(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES categorie_prodotto(id) ON DELETE CASCADE,
  percentuale_provvigione numeric NOT NULL DEFAULT 0,
  attiva boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(compagnia_id, categoria_id)
);
```
Con RLS per admin/cfo/ufficio.

**2. CompagnieList.tsx — Tab "Prodotti & Provvigioni" ristrutturata**

- Dividere la tab in due sezioni:
  - **Provvigioni per Ramo**: tabella Compagnia | Sede | Ramo | Provvigione % (editabile inline). Pulsante "Nuova Provvigione Ramo" con select compagnia + select ramo + input %.
  - **Catalogo Prodotti**: tabella come adesso ma senza colonna provvigione (il prodotto è solo testuale/informativo).

**3. ImmissionePolizzaPage.tsx — Leggere provvigione da compagnia+ramo**

- Quando si seleziona compagnia e categoria/ramo, fare lookup su `provvigioni_compagnia_ramo` invece di `matrice_provvigioni`.
- Il campo provvigione agenzia si auto-compila dalla nuova tabella.

**4. ProvvigioniSedePage.tsx e TitoloDetail.tsx**

- Aggiornare i calcoli per usare la provvigione da `provvigioni_compagnia_ramo` tramite compagnia+ramo del titolo.

**5. Pulizia**

- La tabella `matrice_provvigioni` resta ma non viene più usata per nuovi inserimenti (backward compatibility).

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| Nuova tabella | `provvigioni_compagnia_ramo` (compagnia_id + categoria_id → unique) |
| File modificati | `CompagnieList.tsx`, `ImmissionePolizzaPage.tsx`, `TitoloDetail.tsx`, `ProvvigioniSedePage.tsx` |
| Lookup provvigione | `WHERE compagnia_id = X AND categoria_id = Y AND attiva = true` |
| Tabella prodotti | Resta come catalogo, senza provvigione diretta |

