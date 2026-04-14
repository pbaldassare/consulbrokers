

## Piano: Correzione import duplicati in TitoloDetail.tsx

### Problema identificato
In `src/pages/TitoloDetail.tsx`, la riga 21 importa `Download, Eye, Trash2` da `lucide-react`, ma c'è già un import da `lucide-react` alla riga 12. Questa doppia dichiarazione causa un errore JavaScript a runtime ("Identifier already declared" o simile) che impedisce il caricamento dell'intero bundle dell'applicazione, facendo "esplodere" tutte le pagine.

### Soluzione
- **Riga 21**: eliminare l'import duplicato `import { Download, Eye, Trash2 } from "lucide-react";`
- **Riga 12**: aggiungere `Download, Eye, Trash2` all'import esistente da `lucide-react`

### File coinvolto
- `src/pages/TitoloDetail.tsx` — merge dei due import lucide-react in uno solo

