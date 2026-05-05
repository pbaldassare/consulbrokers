## Risposta alla domanda
Sì, abbiamo già in DB la struttura per le voci RCA Auto:

- **`rca_garanzie`** — tabella di lookup con il catalogo delle garanzie (17 voci attive: `01 Cristalli`, `05 Incendio`, `08 Garanzie accessorie RCA`, `11 Furto`, `12 Assistenza`, `13 Tutela giudiziaria`, `14 Infortuni`, `15 Casko/Collisione`, `02-07 ARD`, `90 Diritti`, `91 Canone Black Box`, ecc.). Campi: `codice`, `descrizione`, `aliquota_tasse`, `attivo`.
- **`premi_garanzia_polizza`** — riga per riga le voci di una specifica polizza. Campi: `titolo_id`, `garanzia` (text), `capitale`, `tasso`, `firma`, `rata`, `annuo`, `ordine`.

Quindi sì: la somma dei vari `firma` / `rata` di `premi_garanzia_polizza` filtrati per `titolo_id` rappresenta la composizione del totale RCA.

## Cosa faccio in questo step (solo etichette)

### 1. Sezione "Importi" in `TitoloDetail.tsx`
Rinomina le due colonne:
- `FIRMA` → **`PREMIO ALLA FIRMA ODIERNO`**
- `QUIETANZA` → **`PREMIO PROSSIMA QUIETANZA`**

Nessun'altra modifica logica/calcolo in questo passaggio.

## Prossimi step (non in questo task — confermare dopo)
Quando approvi, nel passaggio successivo per i titoli del **Ramo RCA Auto** (e affini) aggiungeremo nella card Importi un blocco aggiuntivo con il **dettaglio voci** letto da `premi_garanzia_polizza` (Cristalli / Incendio / Furto / Casko / Assistenza / Tutela / Infortuni / ARD / Diritti …) con colonne `Capitale`, `Tasso`, `Firma`, `Rata`, `Annuo` e totale di quadratura verso `premio_lordo`. Da definire poi: editing inline, regole di calcolo tasse per voce (`rca_garanzie.aliquota_tasse`).
