## Problemi

1. **Premio Lordo — il cursore salta nei decimali appena digiti la prima cifra**
   In `PremiGaranziaCardShell.tsx` (riga 432) l'input Lordo è:
   ```
   value={lordoRow ? lordoRow.toFixed(2) : ""}
   onChange={(e) => handleLordoChange(idx, e.target.value)}
   ```
   `handleLordoChange` ricalcola netto/tasse/ssn ad ogni tasto, poi `lordoRow` ricostruito mostra subito `4.00`, `47.00`, ecc. Risultato: impossibile scrivere `476,50` (e analogamente `1.234,56`) — il caret viene risucchiato nei decimali.

2. **Quietanza non si aggiorna automaticamente con la Firma**
   In `ImmissionePolizzaPage.tsx` (righe 2236–2272) la sincronizzazione è manuale: pulsanti "Salva e copia in Quietanza" e "Sincronizza da Firma". L'utente vuole il comportamento già presente in `TitoloImportiPremiBlock`: ogni modifica alla Firma rispecchiata in automatico sulla Quietanza, con le righe modificate a mano nella Quietanza che diventano "personalizzate" e smettono di seguire la Firma.

## Modifiche

### A) Lordo digitabile a mano libera (`src/components/polizze/PremiGaranziaCardShell.tsx`)

Adottare il pattern **draft locale + commit onBlur** per la cella Lordo:

- Aggiungere uno stato `const [lordoDrafts, setLordoDrafts] = useState<Record<number, string>>({})`.
- L'input Lordo diventa:
  ```
  value={lordoDrafts[idx] ?? (lordoRow ? formatDecimalIt(lordoRow) : "")}
  onChange={(e) => setLordoDrafts(d => ({ ...d, [idx]: e.target.value }))}
  onBlur={(e) => {
    const v = normalizeDecimalOnBlur(e.target.value);
    handleLordoChange(idx, v);          // back-solve netto/tasse/ssn
    setLordoDrafts(d => { const n = { ...d }; delete n[idx]; return n; }); // ripristina lettura da stato
  }}
  ```
- Pulizia del draft anche quando cambia `rows.length` (riga aggiunta/rimossa) per evitare draft "orfani".

Effetto: mentre digiti `4` → `47` → `476` → `476,` → `476,5` → `476,50` l'input mostra esattamente quello che scrivi; solo al blur scatta il back-solve e i campi Netto/Tasse/SSN si popolano. Stesso identico approccio già usato per gli altri campi tramite `normalizeDecimalOnBlur`.

Per coerenza applico lo stesso pattern draft anche a **Netto/Tasse/SSN**, dato che soffrono dello stesso fenomeno (oggi non è evidente solo perché non li ricalcolano da altri campi, ma la formattazione `.toFixed(2)` viene già forzata via `parseDecimalIt` + render). Verifico riga per riga se serve, ma il bug riportato è circoscritto al Lordo: parto da lì, esteso solo se osservo lo stesso comportamento.

### B) Sincronizzazione automatica Firma → Quietanza (`src/pages/ImmissionePolizzaPage.tsx`)

Importare gli helper già esistenti:
```
import {
  syncQuietanzaFromFirma,
  markQuietanzaEdits,
  mirrorAllFromFirma,
  isQuietanzaSincronizzata,
} from "@/components/polizze/premiSync";
```

Sostituire i due handler `onRowsChange` delle card:

```
onRowsChange={(next) => {
  setPremiFirmaRows(next);
  // Mirror automatico: solo le righe Quietanza NON personalizzate seguono la Firma
  setPremiQuietanzaRows((prev) => syncQuietanzaFromFirma(next, prev));
}}
```
e per la Quietanza:
```
onRowsChange={(next) => {
  setPremiQuietanzaRows((prev) => markQuietanzaEdits(prev, next));
}}
```

Allineare anche `addizionaliQuietanza` alla `addizionali` Firma finché l'utente non la modifica a mano (flag locale `addizionaliQuietanzaPersonalizzata`), oppure più semplice: sincronizzo `addizionaliQuietanza ← addizionali` ogni volta che cambia la Firma, e considero qualsiasi edit manuale come "personalizzazione" (set flag). Mantengo l'approccio di `TitoloImportiPremiBlock` per consistenza.

Pulizia dei pulsanti header:
- **Firma**: rimuovo "Salva e copia in Quietanza" (ora è automatico). Lascio eventualmente un pulsante "Copia tutto in Quietanza" che chiama `mirrorAllFromFirma` (azzera personalizzazioni) — utile dopo edit manuali in Quietanza.
- **Quietanza**: "Sincronizza da Firma" → resta come fallback per riallineare manualmente tutto (`mirrorAllFromFirma`), disabilitato se già sincronizzata (`isQuietanzaSincronizzata`).
- Aggiungo prop `personalizzati` + `onResetRow` come in `TitoloImportiPremiBlock` per riallineare una singola riga.

Inizializzazione: al mount/reset, `premiQuietanzaRows` parte come specchio della Firma (oggi parte da `[emptyGaranziaRow()]`); applico `mirrorAllFromFirma(premiFirmaRows)` quando la Firma viene popolata (es. dopo parser AI o dopo selezione sottoramo).

## Verifica

1. Ramo R.C.A. → sottoramo `R.C. MOTO` (alq 16%, SSN 10,50% attivo). Digito nel **Premio Lordo** `4`, `7`, `6`, `,`, `5`, `0`: l'input mostra esattamente la stringa digitata, il caret resta in coda. Al blur: Netto ≈ 376,68 · Tasse ≈ 60,27 · SSN ≈ 39,55 · Lordo riga 476,50. Stesso comportamento con `1.234,56`.
2. Modifico Netto/aliquota/sottoramo della Firma: la Quietanza riflette in automatico (righe non personalizzate). Edito a mano una riga Quietanza → quella riga si "stacca" (badge personalizzata), le altre continuano a seguire la Firma. Il pulsante "Sincronizza da Firma" la riallinea tutta.

## File toccati

- `src/components/polizze/PremiGaranziaCardShell.tsx` — draft locale per Lordo (e, se necessario, Netto/Tasse/SSN).
- `src/pages/ImmissionePolizzaPage.tsx` — auto-sync Firma→Quietanza via `premiSync.ts`, pulsanti header riallineati al pattern di `TitoloImportiPremiBlock`.

Nessuna modifica DB / business logic.
