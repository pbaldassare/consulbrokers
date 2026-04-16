

## Piano: Rinominare "Corrispondente/i" → "Produttore/i" nelle label UI

### Principio
Solo le **label visibili** cambiano. I valori DB (`tipo: "corrispondente"`, `ruolo: "corrispondente"`) restano invariati. Aggiornare anche la memory delle convenzioni terminologiche.

### File e modifiche

**1. `src/pages/AnagraficheProfessionaliPage.tsx`**
- Tab label: `"Corrispondenti"` → `"Produttori"`
- Subtitle: sostituire "Corrispondenti" con "Produttori"
- Commento interno: aggiornare

**2. `src/pages/GestioneUtenti.tsx`**
- `ROLE_LABELS.corrispondente`: `"Corrispondente"` → `"Produttore"`

**3. `src/pages/SitemapPage.tsx`**
- Nome ruolo: `"Corrispondente"` → `"Produttore"`
- Descrizione ruolo: aggiornare testo

**4. `src/pages/ManutenzionePage.tsx`**
- Card title: `"Provisioning Corrispondenti"` → `"Provisioning Produttori"`
- Descrizione: aggiornare testo

**5. `src/pages/CompagnieList.tsx`**
- `"Corrispondente LLOYD'S"` — questo è un dato reale (gruppo statistico), **non toccare**

**6. `src/pages/contGenerale/DichiarativiCUPage.tsx`**
- `"corrispondenti record"` — qui è italiano generico ("i corrispondenti record"), **non toccare**

**7. `src/lib/findRelatedUsers.ts`**
- Commenti interni: aggiornare per chiarezza

**8. `mem://ui/terminology-conventions`**
- Aggiungere: `"Corrispondente"` viene visualizzato come `"Produttore"`

### Non modificati (valori DB, non label)
- Query `.in("tipo", ["corrispondente", ...])` — restano invariate
- `const isCorr = activeTab === "corrispondente"` — resta invariato
- Edge function `provision-corrispondenti-users` — nome funzione resta invariato

