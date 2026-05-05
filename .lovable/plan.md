## Obiettivo

Abilitare anche per le polizze **RC Natanti / Nautica** gli stessi componenti già usati per RCA Auto in `TitoloDetail`:
- Pulsante **Importa con AI** (`ImportPolizzaAiButton`)
- Card gemelle **Firma + Quietanza** (`VociRcaCard` con mirroring DB, override IPT/SSN, totali editabili, sincronizzazione provvigioni)

## Rami coinvolti

Da DB `rami`:
- `QN` — R. C. NATANTI
- `QT` — R. C. I/F NATANTI
- `QNA` — RC+CORPI NAUTICA
- `DD` — CORPI IMBARCAZIONI DIPOR.
- `DNA` — CORPI NAUTICA
- `DN` — CORPI NAVI
- `RV10`, `RV11` (già coperti da prefisso `RV*` esistente)

## Modifiche

### 1. `src/pages/TitoloDetail.tsx` (linee 42-53)

Estendere il set `RAMI_AUTO_CODICI` aggiungendo i codici nautici e rinominare logicamente l'helper a `isRamoVeicoloONatante`, mantenendo l'alias `isRamoAuto` per non toccare le 6 callsite:

```ts
const RAMI_VEICOLO_NATANTE = new Set([
  "PI","QA","QAC","QC","QF","QG","QR","QU","DAB","PJ", // auto esistenti
  "QN","QT","QNA","DD","DNA","DN",                      // natanti / nautica
]);
const isRamoAuto = (ramo: any) => {
  if (!ramo) return false;
  const cod = String(ramo.codice || "").toUpperCase().trim();
  const desc = String(ramo.descrizione || "").toUpperCase();
  if (RAMI_VEICOLO_NATANTE.has(cod)) return true;
  if (cod.startsWith("RV")) return true;
  if (/\bAUTO\b|\bAUTOVEIC|\bAUTOCARR|\bVEICOL|\bNATANT|\bNAUTIC/.test(desc)) return true;
  return false;
};
```

Effetto a cascata (zero ulteriori modifiche richieste):
- linea 1248-1249: `ImportPolizzaAiButton` viene mostrato anche per RC Natanti
- linea 2473-2516: le due card `VociRcaCard` Firma + Quietanza appaiono per RC Natanti
- linea 2287/2330/2335: i blocchi importi alternativi vengono già correttamente nascosti
- linea 2656: la sezione "Dati Veicolo" appare anche per Natanti — è coerente (contiene già campi adatti come targa/telaio = matricola/scafo, marca/modello, anno acquisto, ecc.). Cambieremo solo il **titolo della sezione** in `Dati Veicolo / Natante`.

### 2. `src/components/polizze/VociRcaCard.tsx`

Nessuna logica da cambiare: la card è già agnostica rispetto al ramo (riga "RCA principale" funge da riga premio principale). Rinominiamo solo la **label visiva** della riga principale da "RCA Auto" a un'etichetta dinamica:
- se `titolo.ramo.codice` ∈ {QN, QT, QNA, DD, DN, DNA} ⇒ label `RC Natanti` (o `Corpi` per DD/DN/DNA)
- altrimenti ⇒ label corrente `RCA Auto`

Stessa cosa nell'`ImportPolizzaAiButton.tsx` linea 165 (`garanzia: "RCA Auto"`) e nelle righe 333 (`<SelectItem value="RCA"> RCA Auto (principale)`): rese dinamiche in base al ramo del titolo (richiede passare `ramo` come prop opzionale al pulsante; default "RCA Auto").

### 3. Edge Function `parse-polizza-rca`

Continua a funzionare invariata: estrae voci di garanzia generiche da PDF/immagine. Per i Natanti il prompt riconosce comunque le voci tipiche (RC Natanti, Corpi, Furto/Incendio, Infortuni Conducente, Assistenza, ecc.). **Non si modifica.**

### 4. Memoria

Aggiornare `mem://insurance/rca-voci-composizione-premio` per indicare che il sistema copre anche i rami **Natanti / Nautica** elencati sopra, e aggiungere una nuova memoria di mappatura nautica se utile.

## File toccati

- `src/pages/TitoloDetail.tsx` — set rami + titolo sezione veicolo dinamico
- `src/components/polizze/VociRcaCard.tsx` — label riga principale dinamica
- `src/components/polizze/ImportPolizzaAiButton.tsx` — accetta prop `ramo`, label/garanzia dinamici, default invariato
- `.lovable/memory/insurance/rca-voci-composizione-premio.md`

## Note

- Nessuna migration DB richiesta (lo schema `premi_garanzia_polizza` è già generico).
- I trigger `sync_quietanza_da_firma` continuano a funzionare per qualsiasi titolo.
- Aliquote tasse di default: per RC Natanti `aliquota_tasse_ramo=16` (DB); il calcolo riga RCA principale (imposta provinciale + SSN) resta valido — per DD/DN/DNA puri (corpi) l'utente potrà comunque sovrascrivere l'aliquota a `12.5`/`7.5` dalla card.
