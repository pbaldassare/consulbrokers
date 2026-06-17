Confermo, ho capito. In `src/components/polizze/azioni/AppendiceDialog.tsx`:

1. **Tipi appendice** — ridurre `TIPI_APPENDICE` a sole 3 voci:
   - `modifica` → "Modifica"
   - `proroga` → "Appendice di proroga"
   - `regolazione` → "Regolazione"
   
   Rimuovere `integrazione`, `rettifica`, `annullamento_parziale`.

2. **Numero appendice automatico** — calcolato come `max(numero_appendice esistenti) + 1` per quella polizza (logica già presente in `useQuery` + `useEffect`):
   - Campo `<Input>` reso **read-only** (disabled) — l'utente non può modificarlo.
   - Resta visibile per trasparenza ma è gestito automaticamente dal sistema.
   - Se non ci sono appendici → 1, se ce n'è una → 2, ecc.

Nessuna modifica a DB, logica di salvataggio o altri componenti.
