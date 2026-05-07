## Obiettivo

In `TitoloDetail` (sezione **Importi** del titolo RCA):

1. **Spostare le due card di split provvigioni** ("Provvigioni alla Firma" / "Provvigioni Quietanza") **sotto le card di Composizione Premio** (`VociRcaCard` Firma e Quietanza), invece che in alto vicino al riepilogo Premi.
2. **Correggere la percentuale di split**: oggi il titolo ha `percentuale_commerciale = 100` mentre l'anagrafica INTERFIDI SRL ha `percentuale_base = 40`. Allineare il dato e impedire che si rompa di nuovo.

Nessun cambio a logiche backend di calcolo provvigioni (`calcola-provvigioni`): si tocca solo la UI di TitoloDetail e si fa un piccolo fix dati.

## Modifiche UI — `src/pages/TitoloDetail.tsx`

### A. Riposizionare le card di split sotto le Composizioni RCA

Sezione "Importi", ramo Auto (righe ~2468–2547):

- Mantenere invariate le due `VociRcaCard` (Firma + Quietanza).
- **Subito dopo** ciascuna `VociRcaCard`, renderizzare la rispettiva card di split:
  - Sotto `VociRcaCard tipoPremio="firma"` → `renderSplitImporti("Provvigioni alla Firma", sFirma, "teal")`
  - Sotto `VociRcaCard tipoPremio="quietanza"` → `renderSplitImporti("Provvigioni Quietanza", sQui, "amber")`
- **Rimuovere** il blocco attuale che, per ramo Auto, mostra le due card di split affiancate in cima alla sezione Importi (righe ~2317–2322, ramo `isRamoAuto` view-mode).
- Per i rami **non-Auto** lasciare tutto invariato (split mostrati accanto ai riepiloghi Firma/Quietanza, righe ~2293–2316).
- Lo split in **"Commerciale & Provvigioni"** (sezione precedente) resta come oggi: hint testuale che le card di dettaglio sono in "Importi" sotto i premi.

### B. % Commerciale corretta

Sul titolo `076a48d8-…` il valore è `100` ma l'anagrafica ha `percentuale_base = 40`. Due interventi:

1. **Fix dato del titolo corrente** via migrazione SQL puntuale:
   ```sql
   UPDATE public.titoli t
      SET percentuale_commerciale = ap.percentuale_base
     FROM public.anagrafiche_professionali ap
    WHERE t.anagrafica_commerciale_id = ap.id
      AND t.id = '076a48d8-f31f-4911-8faf-0f680ff02672'
      AND ap.percentuale_base IS NOT NULL;
   ```
   Non viene eseguito un update di massa per non alterare titoli già negoziati con override volontario.

2. **Hardening UI in edit "Commerciale & Provvigioni"** (righe ~2095–2128):
   - Quando si seleziona un commerciale, se l'anagrafica espone `percentuale_base`, prefillare `percentuale_commerciale` con quel valore (già fatto). Aggiungere una **pill informativa** sotto l'input `% Commerciale` del tipo `Default anagrafica: 40% — Reset` con un piccolo bottone link che reimposta il valore al `percentuale_base` corrente. Nessun salvataggio automatico.

Nessun trigger DB nuovo: la `% Commerciale` resta editabile (override consapevole) ma l'utente vede chiaramente il default dell'anagrafica.

## Risultato atteso

- In sezione **Importi** del titolo RCA visualizzato:
  - Card "Composizione Premio RCA — Firma" → subito sotto, card teal "Provvigioni alla Firma" con split **40% INTERFIDI SRL / 60% Consulbrokers SPA**.
  - Card "Composizione Premio RCA — Quietanza" → subito sotto, card amber "Provvigioni Quietanza" con stesso split.
- Sezione "Commerciale & Provvigioni" mostra `40%` sul badge accanto al nome commerciale.
- Tutti gli importi continuano a usare `fmtEuro` (formato italiano con € e separatori).

## File toccati

- `src/pages/TitoloDetail.tsx` (UI riordino + reset pill)
- 1 migrazione SQL puntuale per fix `percentuale_commerciale` del titolo corrente
