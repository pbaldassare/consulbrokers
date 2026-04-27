## Nascondere tab "Agenzie Sinistri" da /compagnie

### Problema
In `/compagnie` la tab **"Agenzie Sinistri"** è visibile tra "Agenzie" e "Import Provvigioni IA". L'utente non la usa al momento e vuole nasconderla completamente (label + contenuto).

### Soluzione

**File modificato**: `src/pages/CompagnieList.tsx`

1. Rimuovo il `<TabsTrigger value="sinistri">` (righe 1081-1083) — la label "Agenzie Sinistri" con icona `ShieldAlert`.
2. Rimuovo il corrispondente blocco `<TabsContent value="sinistri">` (più sotto nello stesso file) con tutto il contenuto della tab.
3. Se l'import di `ShieldAlert` da `lucide-react` resta inutilizzato, lo rimuovo.

### Risultato
Tab rimanenti in `/compagnie`:
- Compagnie
- Agenzie
- Import Provvigioni IA
- Agenzie di riferimento (Prossimamente)

### Cosa NON tocco
- ❌ Nessuna modifica DB
- ❌ Nessuna delle altre tab
- ❌ Nessun dato sulle agenzie sinistri (resta tutto in DB, solo nascosto dall'UI)

### Verifica
1. `/compagnie` → la tab "Agenzie Sinistri" non appare più
2. Le altre 4 tab restano funzionanti
3. Nessun errore console
