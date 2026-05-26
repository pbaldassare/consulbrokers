
# Piano: contributo SSN per sottorami RCA

## Esempio di riferimento (concordato)

Sottoramo `070 - R.C.A. Autovetture`, flag SSN ON, aliquota 10,5%:
- Netto: **1.000,00 €**
- Tasse (12,5% ramo): **125,00 €**
- **Lordo imponibile SSN**: 1.000 + 125 = **1.125,00 €**
- **SSN (10,5% del lordo)**: **118,13 €** (editabile)
- **Lordo finale polizza**: 1.000 + 125 + 118,13 = **1.243,13 €**

Se sottoramo NON ha il flag → nessun campo SSN, lordo = netto + tasse.

## 1. Database (migrazione)

Sulla tabella `rami` (sottorami):
- `ssn_attivo boolean NOT NULL DEFAULT false`
- `aliquota_ssn numeric(5,2) NULL` (es. 10.50)

Sulla tabella `premi_garanzia_polizza`:
- `ssn numeric(12,2) NOT NULL DEFAULT 0` — importo SSN della riga (firma o quietanza)

Sulla tabella `titoli`:
- `ssn_firma numeric(12,2) NOT NULL DEFAULT 0`
- `ssn_quietanza numeric(12,2) NOT NULL DEFAULT 0`
- (totali aggregati per visualizzazione/cassa, paralleli a tasse/addizionali esistenti)

Nessun calcolo automatico in trigger DB: il calcolo vive in UI/edge (più facile da rendere editabile). I trigger esistenti di lordo che oggi fanno `netto+tasse+addizionali` vengono estesi a `+ssn`.

## 2. UI — Tabelle di Base / Rami (`src/pages/TabelleBasePage.tsx`)

- **Nascondere** colonna "% Tasse ARD" (campo DB resta).
- **Aggiungere**:
  - Toggle "SSN" (boolean)
  - Input "% SSN" mostrato solo se toggle ON, default 10,50
- Editor "Nuovo Ramo" / modifica riga aggiornato di conseguenza.

## 3. Hook lookup rami (`src/hooks/useRamiLookup.ts`)

Estendere `RamoOption` con `ssn_attivo: boolean` e `aliquota_ssn: number | null`. Query select aggiunge i due campi.

## 4. Immissione polizza manuale (`src/pages/ImmissionePolizzaPage.tsx`)

Nelle card "Composizione Premio — Firma" e "— Quietanza" (`PremiGaranziaCardShell`):
- Su ogni riga, dopo selezione sottoramo, leggere `ssn_attivo` + `aliquota_ssn`.
- Se attivo: mostrare nuova cella **SSN** accanto a Tasse:
  - calcolo: `ssn = round((netto + tasse) * aliquota_ssn / 100, 2)`
  - ricalcolato automaticamente quando cambia netto, tasse o aliquota
  - editabile a mano (override mantenuto finché l'utente non resetta o non cambia netto)
  - flag `ssn_manual_override` per riga (solo client-side)
- Totale riga (lordo riga) = netto + tasse + ssn.
- Footer card: somma SSN delle righe → salvata in `titoli.ssn_firma` / `ssn_quietanza`.
- Se nessuna riga ha flag → footer SSN non visibile.

Salvataggio: payload insert/update include `ssn` per riga e `ssn_firma`/`ssn_quietanza` per titolo.

## 5. TitoloDetail (`src/pages/TitoloDetail.tsx`)

Stessa logica della card di immissione (già condivisa via `PolizzaSection`). Per polizze esistenti senza SSN: il campo appare comunque se il sottoramo ha `ssn_attivo=true`, parte da 0/calcolato, editabile, salva al submit.

## 6. AI parser (`supabase/functions/parse-polizza-rca/`, `parse-polizza-completa/`)

- Aggiornare schema JSON di output: per ogni riga garanzia, campo opzionale `ssn`.
- Prompt: istruire l'AI a estrarre la voce "SSN" / "Servizio Sanitario Nazionale" / "Contributo SSN" se presente nel PDF.
- Lato frontend (`AiPrefilledForm` / merge dei dati nelle card premio): se sottoramo mappato ha `ssn_attivo`, e l'AI non ha fornito SSN, calcolarlo (10,5% lordo); se l'ha fornito, usare quello.

## 7. Quietanza auto-generata (`supabase/functions` + trigger esistente)

Il trigger DB che clona la rata successiva copia anche `ssn` di ogni riga e `ssn_quietanza` del titolo padre (proporzionale al netto rata, calcolato in PL/pgSQL: `ssn = round((netto+tasse)*aliquota_ssn/100, 2)` leggendo `rami.ssn_attivo/aliquota_ssn` per sottoramo).

## 8. Visualizzazione totali / E/C / PDF

Pagine impattate (lettura): `PortafoglioCaricoPage`, `PortafoglioAttivePage`, `PortafoglioStoricoPage`, `TitoloDetail`, `MessaCassaDialog`, `ec-*-pdf.ts`, `rimessa-pdf.ts`, `incassi-coperture-pdf.ts`.
- Lordo già esposto come campo `lordo_*` aggiornato dal trigger DB → automaticamente include SSN.
- Aggiungere riga "di cui SSN: x €" sotto la voce Tasse nei dettagli polizza (TitoloDetail card Composizione + PDF E/C) per trasparenza. Solo se > 0.

## 9. Memoria di progetto

Nuovo memory file `mem://insurance/ssn-contribution` che descrive: flag su sottoramo, calcolo su lordo (netto+tasse), default 10,5%, editabilità, propagazione a quietanze, ambito RCA Auto.

## Out of scope (non in questo task)

- Retroattività su polizze già messe a cassa (rimangono invariate).
- Calcolo SSN proporzionale su appendici/storni: tratti come oggi (somma algebrica delle righe garanzia, SSN incluso).
- Modifica della colonna `aliquota_tasse_ard` (resta sul DB ma orfana, eliminabile in seguito).

## Sezione tecnica — file toccati

```text
DB migration              → rami, premi_garanzia_polizza, titoli + update trigger lordo
src/pages/TabelleBasePage.tsx              (UI rami: nasconde ARD, aggiunge SSN)
src/hooks/useRamiLookup.ts                 (espone ssn_attivo, aliquota_ssn)
src/components/polizze/PremiGaranziaCardShell.tsx  (cella SSN per riga)
src/components/polizze/PolizzaSection.tsx          (totali SSN)
src/pages/ImmissionePolizzaPage.tsx        (payload insert con SSN)
src/pages/TitoloDetail.tsx                 (payload update con SSN, display)
supabase/functions/parse-polizza-rca/index.ts       (schema + prompt SSN)
supabase/functions/parse-polizza-completa/index.ts  (schema + prompt SSN)
src/components/ai/AiPrefilledForm.tsx               (merge SSN da AI o autocalc)
PDF lib: ec-*-pdf.ts, rimessa-pdf.ts                (riga "di cui SSN")
mem://insurance/ssn-contribution                    (nuova memoria)
```
