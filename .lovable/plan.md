## Obiettivo

1. **Rami non-auto**: la sezione "Importi" (Premio Netto / Tasse / Lordo / Provvigioni / Totali) **non deve più esistere come card separata** — i totali vanno calcolati e mostrati direttamente in fondo alle card **Premi per Garanzia — Firma** e **Premi per Garanzia — Quietanza**. La tabella visiva tipica RCA (sotto-righe IPT/SSN, colonna "Imposta provinciale", riga RCA principale obbligatoria) **non deve essere richiamata** quando il ramo non è auto.
2. **Aliquota tasse di default**: leggere `aliquota_tasse_ramo` dalla tabella `rami` (campo già presente nella query del titolo) — fallback a 22.25% solo se nullo. Niente più 13.5% hardcoded per i non-auto.
3. **Concetto "personalizzato"** (oggi solo Quietanza): introdurlo anche su **RCA Firma** — quando un valore IPT/SSN viene editato manualmente, mostrare badge "Personalizzato" con pulsante "Ripristina calcolo automatico" (già esiste come "Ricalcola IPT/SSN", va solo allineato visivamente con badge + tooltip).

## Modifiche

### 1. `VociRcaCard.tsx`

**Nuova prop**
- `mostraTotaliFooter?: boolean = false` — quando `true`, in fondo alla card mostra un blocco "Totali" con: Premio Netto, Addizionali, Tasse, **Premio Lordo**, Provvigioni (se `provvigioniValue` è gestito).
  - Per non-auto: i totali sono semplici somme delle voci (`Σ netto`, `Σ tasse = Σ(lordo - netto)`, `Σ lordo`).
  - Le righe del footer sono editabili inline solo per "Provvigioni" (campo già esistente). Premio Lordo è readonly e calcolato.
- `mostraCampoAddizionali?: boolean = false` — colonna opzionale "Addizionali" per riga (richiesto da contabilità non-auto). Valore salvato in nuova colonna se utile, altrimenti aggregato in `tasse`. **Per ora**: mostro solo riga "Addizionali" nel footer come campo libero salvato su `titoli.addizionali` / `titoli.addizionali_quietanza` via callback.

**Refactor visuale per `useAutoTaxFormula={false}`**
- Header card: titolo dinamico (già passato via prop `titolo`); rimuovere l'icona `Car`/`ShieldCheck` RCA-specifica e usare `ShieldCheck` neutro.
- Tabella: mai mostrare la riga "RCA Auto" sintetica, mai mostrare le sotto-righe IPT/SSN, mai mostrare il selettore aliquota provinciale globale. Colonne: `Garanzia | Netto | Aliquota % | Lordo | Capitale | Tasso ‰ | Rata | Annuo | ⌫`.
- Pulsante "Ricalcola IPT/SSN" e blocco "Imposta provinciale" nascosti.
- "Aggiungi voce libera" sempre disponibile.

**Concetto "personalizzato" su RCA (anche Firma)**
- Quando `is_rca_principale=true` e `overrideImposta || overrideSsn` (logica già presente in `calcolaLordo`), mostrare badge piccolo "Personalizzato" accanto al nome riga e link "Ripristina automatico" (già esistente come "Ricalcola IPT/SSN") → spostarlo inline alla riga invece che solo nell'header.
- Su Quietanza, badge "Quietanza personalizzata" già esiste e resta.

### 2. `TitoloDetail.tsx`

**Sezione "Importi" (linee ~2488-2755)** — nuova logica di branching:

- **Se `isRamoAuto`** (auto/natanti): comportamento attuale invariato. La card "Importi" resta con form modifica completa, e sotto le `VociRcaCard` Firma/Quietanza alimentano `titoli.premio_netto/tasse/...` come oggi. (No regressione RCA.)

- **Se NON `isRamoAuto`**: 
  - **Rimuovere** la card `SectionCollapsible "Importi"` per intero (form modifica + visualizzazione).
  - La sezione `SectionCollapsible "Premi per Garanzia"` (linee ~3003-3085) diventa l'unica fonte di importi: contiene le due `VociRcaCard` (Firma+Quietanza) con `mostraTotaliFooter={true}` e `mostraCampoAddizionali={true}`.
  - Spostare al loro interno: `renderSplitImporti("Provvigioni alla Firma"/"Quietanza")`, lo switch valuta/cambio (se esiste resta in una sotto-card), i flag `indicizzata` / `rimborso` (in un piccolo footer sotto le due card o eliminati se non usati per non-auto — verifico, decido in fase di build).
  - I totali calcolati nelle card sincronizzano `titoli.premio_netto`, `tasse`, `premio_lordo`, `premio_netto_quietanza`, `tasse_quietanza` via callback `onTotaliChange` (già implementato).
  - `addizionali` / `addizionali_quietanza`: editabili inline nel footer della card (debounced UPDATE su `titoli`).

**Aliquota da `rami`**
- Verificare che la query del titolo selezioni `rami.aliquota_tasse_ramo`. Se assente, aggiungerla.
- Passare `aliquotaDefault={t.ramo?.aliquota_tasse_ramo ?? 22.25}` alle `VociRcaCard` non-auto (già previsto in plan precedente, lo confermo).

### 3. Cleanup

- Codice morto da rimuovere se diventa inutilizzato per il path non-auto: `editingImporti`, `importiForm`, `saveImportiMutation`, `startEditImporti` restano ma vengono usati **solo** quando `isRamoAuto` è vero. Niente rimozione globale per evitare regressioni RCA.

## Cosa NON cambia

- Schema DB: nessuna modifica.
- Polizze RCA esistenti: layout RCA invariato, solo il badge "Personalizzato" viene reso più visibile.
- Trigger sync Firma↔Quietanza: invariati.
- `ImportPolizzaAiButton`: invariato.

## Verifica post-build

1. Aprire un titolo RCA Auto → sezione "Importi" presente come oggi, con sotto le card Firma/Quietanza RCA. Editare manualmente IPT su Firma → compare badge "Personalizzato" inline + link "Ripristina automatico".
2. Aprire un titolo Incendio/Vita/RCT → **niente** card "Importi" separata. Solo la sezione "Premi per Garanzia" con due card teal Firma/Quietanza che mostrano in basso il footer Totali (Netto/Addizionali/Tasse/Lordo/Provvigioni). Aliquota di default = `aliquota_tasse_ramo` del ramo (es. 22.25%).
3. Modificare una voce non-auto → totali nel footer si aggiornano, `titoli.premio_netto/tasse/lordo` aggiornati nel DB, e `titoli.premio_netto_quietanza/tasse_quietanza` per la card Quietanza.
4. AI scan funziona su entrambi i path.
5. `renderSplitImporti` (split commerciale/agenzia) appare sotto ciascuna card Firma/Quietanza in entrambi i casi.

## File toccati

- `src/components/polizze/VociRcaCard.tsx` (nuove prop `mostraTotaliFooter`, `mostraCampoAddizionali`; badge "Personalizzato" inline su RCA principale)
- `src/pages/TitoloDetail.tsx` (branching Importi auto/non-auto; rimozione card Importi per non-auto; passaggio nuove prop)
