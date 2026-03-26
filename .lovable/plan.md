

## Piano: Unificare Compagnie + Categorie + Prodotti + Provvigioni

### Concetto compreso

La struttura attuale (3 pagine separate: Compagnie, Categorie, Prodotti) va unificata in un'unica pagina "Compagnie". Ogni record compagnia rappresenta una **Compagnia + Sede** (es. "Allianz - Milano 1", "Allianz - Roma 2"). Possono esistere decine di record per la stessa compagnia madre con sedi diverse. Dentro ogni compagnia/sede, si gestiscono i **prodotti** (con categoria e nome testuale) e le **provvigioni**.

```text
Compagnia (Allianz)
  └─ Sede (Milano 1)
       └─ Categoria (Tutela Legale)
            └─ Prodotto (T Legale Allianz) → Provvigione 12%
```

### Interventi

**1. Migration SQL — campo `nome_sede` su compagnie**
- `ALTER TABLE compagnie ADD COLUMN nome_sede text` — per distinguere le sedi (es. "Milano 1", "Roma Centro")
- La combinazione nome + nome_sede identifica univocamente la compagnia/sede

**2. CompagnieList.tsx — Nuova tab "Prodotti & Provvigioni"**
- Aggiungere una terza tab oltre "Anagrafica" e "Sinistri": **"Prodotti & Provvigioni"**
- La tab mostra una tabella espandibile:
  - Colonne: Compagnia, Sede, Categoria, Prodotto, Provvigione %, Stato
  - Filtri per compagnia e categoria
  - Pulsante "Nuovo Prodotto" che apre dialog con: select compagnia/sede, select categoria, nome prodotto (testo libero), % provvigione
  - Modifica inline della provvigione con click sulla riga

**3. CompagnieList.tsx — Aggiungere campo "Sede" nel form compagnia**
- Nel dialog di creazione/modifica compagnia, aggiungere campo "Nome Sede" accanto al nome compagnia
- Es.: Nome = "Allianz", Sede = "Milano 1"

**4. Sidebar e Routes — Rimuovere Prodotti e Categorie**
- Rimuovere le voci "Categorie" e "Prodotti" dalla sidebar (`AppSidebar.tsx`)
- Rimuovere le route `/categorie` e `/prodotti` da `sistema.tsx`
- Le pagine `CategorieList.tsx` e `ProdottiList.tsx` restano nel codice ma non sono piu raggiungibili dal menu

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| Migration | `ALTER TABLE compagnie ADD COLUMN nome_sede text` |
| File modificati | `CompagnieList.tsx`, `AppSidebar.tsx`, `src/routes/sistema.tsx` |
| Query prodotti nella tab | `prodotti` JOIN `compagnie` JOIN `categorie_prodotto` JOIN `matrice_provvigioni` |
| Creazione prodotto | INSERT in `prodotti` + INSERT in `matrice_provvigioni` (se provvigione specificata) |
| Tabella categorie | Resta come lookup, gestibile inline nella tab prodotti |

