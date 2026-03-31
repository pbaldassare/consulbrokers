

## Piano: Rinominare "Backoffice" in "Specialist"

### Ambito
Cambiare tutte le etichette visibili "Backoffice" → "Specialist" nell'interfaccia. Il valore interno nel database (`backoffice`) resta invariato per evitare migrazioni rischiose — cambia solo il testo mostrato all'utente.

### File da modificare (10 file, ~30 sostituzioni)

| File | Cosa cambia |
|------|-------------|
| `src/pages/SitemapPage.tsx` | Nome ruolo "Backoffice" → "Specialist" + tutti i badge/label |
| `src/pages/GestioneUtenti.tsx` | Label ruolo nella lista utenti |
| `src/pages/ClientiList.tsx` | Label "Backoffice" in accordion e ruoli commerciali → "Specialist" |
| `src/pages/ClienteDetail.tsx` | Label ruolo commerciale `backoffice` → "Specialist" |
| `src/pages/TitoloDetail.tsx` | Label campo "Backoffice" → "Specialist" |
| `src/pages/ImmissionePolizzaPage.tsx` | Label "Backoffice" → "Specialist" |
| `src/pages/RinnoviPolizzaPage.tsx` | Label e placeholder "Backoffice" / "Tutti i backoffice" → "Specialist" / "Tutti gli specialist" |
| `src/components/chat/NuovaConversazioneDialog.tsx` | Label ruolo "Backoffice" → "Specialist" |
| `src/pages/PortafoglioList.tsx` | Eventuali label "Backoffice" |
| `src/components/RoleGuard.tsx` | Eventuali label visibili |

### Regola
- Valore DB/enum: resta `"backoffice"` (nessuna migrazione)
- Testo UI visibile: diventa **"Specialist"** ovunque
- Variabili JS (`backofficeRole`, `setBackofficeRole`): restano invariate (refactor cosmetico non necessario)

