

## Piano: Filtri e badge per tipo pagamento e conferimento gestito in EC Compagnia

### Contesto
Il campo `tipo_pagamento` è già salvato nella tabella `titoli` durante la messa a cassa (valori: contanti, carta_credito, bonifico). L'utente chiede:
1. Sostituire "Carta di Credito" con **"POS"** ovunque
2. Mostrare badge per tipo pagamento e conferimento gestito nella tabella espansa EC Compagnia
3. Aggiungere filtri per tipo pagamento e per distinguere messa a cassa vs conferimento gestito

### Modifiche

**1. `src/pages/TitoloDetail.tsx`** — Rinominare opzione pagamento
- Sostituire `carta_credito` → `pos` come valore e "Carta di Credito" → "POS" come label in entrambi i dialog (Conferma Incasso e Conferimento Gestito)
- Aggiornare anche la visualizzazione nel FieldRow "Tipo Pagamento"

**2. `src/pages/contabilita/ECCompagniaContabPage.tsx`** — Aggiungere dati e filtri
- Aggiungere `tipo_pagamento` alla query dei titoli
- Aggiungere all'interfaccia `TitoloDetail` il campo `tipo_pagamento`
- Nella tabella espansa, aggiungere colonna **Tipo Pagamento** con badge colorati:
  - Contanti → badge grigio
  - POS → badge blu
  - Bonifico → badge indaco
- Nella colonna Stato Fondi, aggiungere anche badge per distinguere **Incasso diretto** vs **Conferimento Gestito** (già parzialmente presente)
- Aggiungere **due filtri** nel pannello filtri:
  - **Tipo Pagamento**: Tutti / Contanti / POS / Bonifico
  - **Modalità Incasso**: Tutti / Incasso Diretto / Conferimento Gestito / In Attesa Fondi

**3. `src/pages/ContabilitaUfficio.tsx`** — Stessa logica badge tipo pagamento
- Aggiungere `tipo_pagamento` alla query e mostrare badge nella tabella espansa (coerenza)

### Nessuna migrazione DB necessaria
Il campo `tipo_pagamento` esiste già su `titoli`. Il valore `pos` è una stringa libera, non vincolata da enum DB.

### File coinvolti
- `src/pages/TitoloDetail.tsx` — rinominare carta_credito → pos
- `src/pages/contabilita/ECCompagniaContabPage.tsx` — filtri + badge
- `src/pages/ContabilitaUfficio.tsx` — badge tipo pagamento (coerenza)

