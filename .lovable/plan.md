## Nascondere campi non necessari in Immissione Polizza

File: `src/pages/ImmissionePolizzaPage.tsx` (righe ~2710-2737)

**Da rimuovere dalla UI** (state e setter restano per non rompere logica di salvataggio):
- Checkbox `Indicizzata`
- Checkbox `Pag. Diretto Agenzia`
- Checkbox `Emissione Fee`
- Checkbox `Formato Elettronico`
- Campo `Valuta` (select EUR/USD/GBP) — il valore default "EUR" resta nello state
- Riga informativa `ℹ️ Fax/Copertura/Data Incasso vengono compilati nella Messa a Cassa…`

**Restano visibili**: `Rimborso` e `No Calcolo Tasse`.

Nessuna modifica a logica/DB: solo rimozione voci dall'array dei flag, rimozione del blocco `<div>` Valuta e del `<p>` informativo.