## Obiettivo

Replicare il pattern RCA (catalogo garanzie filtrato per `gruppo_ramo`) per **tutti i rami**. Quando in una polizza (esistente o nuova) si imposta Ramo + Sottoramo, le card **Premio Firma** e **Premio Quietanza** devono mostrare nel dropdown "Voce / Garanzia" **solo le garanzie collegate al Gruppo Ramo selezionato**, e accettare solo quelle.

## Stato attuale

- `rca_garanzie` ha già `gruppo_ramo_id NOT NULL` ma è popolata solo per **ZQ – R.C.A.** (18 garanzie). Gli altri 11 gruppi (Corpi, Incendio, Infortuni, RCT, Vita, …) hanno 0 garanzie.
- `VociRcaCard.tsx` filtra il catalogo `.eq('gruppo_ramo_id', gruppoRamoTitolo)` → su rami non-RCA il dropdown è vuoto, e la card oggi viene mostrata solo per `isRamoAuto` (auto + natanti). Sugli altri rami in TitoloDetail c'è una tabella Importi semplice; in `ImmissionePolizzaPage` c'è `PremiGaranziaCardShell` (shell visiva senza catalogo).

## Decisione architetturale

Promuovere `rca_garanzie` a **catalogo generico garanzie per Gruppo Ramo** (ribattezzandolo concettualmente "Catalogo Garanzie", senza rinominare la tabella per non rompere FK/migrazioni esistenti). Stessa struttura, stessa UI di gestione in Tabelle di Base, stessa relazione `gruppo_ramo_id`. La tabella `premi_garanzia_polizza` resta invariata (continua a usare `codice_garanzia` testuale).

## 1. Dati / Tabelle di Base

- **Estendere l'editor `RcaGaranzieTab`** (`TabelleBasePage.tsx`):
  - Rinominare la tab in **"Catalogo Garanzie"**.
  - Mantenere la colonna/select **Gruppo Ramo** (già obbligatoria, default ZQ).
  - Aggiungere filtro lista per Gruppo Ramo in alto.
- **Seed minimo per ogni Gruppo Ramo non RCA**: inserire una garanzia "principale" per gruppo, così la card non resta vuota quando si seleziona un nuovo ramo. La compilazione completa del catalogo per ogni gruppo è poi a carico dell'utente da Tabelle di Base.

  ```text
  Gruppo  → garanzia principale (codice / descrizione / aliquota_tasse)
  ZD      → CORPI   / Corpi                              / 21.25
  ZL      → INC     / Incendio Furto Rischi Tecnologici  / 21.25
  ZN      → INF     / Infortuni                          / 2.50
  ZM      → MAL     / Malattia                           / 2.50
  ZP      → RCT     / R.C. Terzi                         / 21.25
  ZS      → TG      / Tutela Giudiziaria                 / 21.25
  ZC      → CRC     / Credito / Cauzioni                 / 21.25
  ZT      → TRA     / Trasporti                          / 7.50
  ZV      → VITA    / Vita                               / 2.50
  ZY      → ALTRI   / Altri Rami Danni                   / 21.25
  DI      → ASS     / Assistenza                         / 10.00
  ```

  (le aliquote indicative sono editabili da Tabelle di Base; nessun blocco)

## 2. UI Polizze (esistenti) – `TitoloDetail.tsx`

- Estendere il rendering delle due card **Premi per Garanzia – Firma / Quietanza** (oggi `<VociRcaCard>` solo se `isRamoAuto`) a **tutti i rami**.
- La sezione Importi diventa quindi sempre composta da:
  - Card Firma (teal) + Card Quietanza (amber) basate su `VociRcaCard`.
  - La tabella "Importi semplice" attuale per non-RCA viene rimossa (sostituita dalle card).
- `VociRcaCard` modifiche minime:
  - Prop nuovo opzionale `mainVoceObbligatoria?: boolean` (default `true` solo per RCA/Natanti). Per gli altri rami **nessuna riga obbligatoria pre-inserita**.
  - `useAutoTaxFormula` resta `true` per auto/natanti, `false` per gli altri (lordo = netto × (1 + aliquota%)).
  - `mostraCampiCapitaleRata` resta su Auto/Natanti.
  - Il filtro catalogo su `gruppo_ramo_id` è già attivo: niente da cambiare.
- Mirroring Firma↔Quietanza (`sync_quietanza_da_firma` + trigger) **resta valido per tutti i rami**: nessuna modifica al trigger.

## 3. UI Nuova Emissione – `ImmissionePolizzaPage.tsx`

Oggi usa `PremiGaranziaCardShell` (solo grafica, senza catalogo, senza persistenza voci). Per allinearla al pattern serve un titolo in DB → due opzioni proposte all'utente più avanti; per il piano corrente:

- **Step A (questo piano)**: rendere `PremiGaranziaCardShell` un vero **catalogo-aware shell**:
  - Riceve `gruppoRamoId` derivato dalla selezione `RamoSottoramoSelect`.
  - Carica `rca_garanzie` filtrate per quel `gruppo_ramo_id` (stessa query di `VociRcaCard`).
  - Le voci vengono gestite in **stato locale** (array di righe `{ codice_garanzia, descrizione, premio_netto, aliquota, premio_lordo }`) e mostrate con lo stesso layout di `VociRcaCard`.
  - Cambio Sottoramo → reset righe (con conferma se non vuote).
- **Step B (fuori scopo, già concordato)**: persistenza vera in `premi_garanzia_polizza` al momento del primo salvataggio del titolo (batch insert delle righe locali).

## 4. File toccati

```text
NEW migration: 20260511_xxxxxx_seed_garanzie_per_gruppo.sql
   - INSERT garanzia principale per ogni gruppo_ramo non-RCA (idempotente)

EDIT  src/pages/TabelleBasePage.tsx (RcaGaranzieTab)
   - rinomina label tab "Catalogo Garanzie"
   - filtro lista per gruppo_ramo

EDIT  src/components/polizze/VociRcaCard.tsx
   - prop mainVoceObbligatoria (default true se isRamoAuto/Natante, false altrimenti)
   - skip seed automatico riga principale quando false

EDIT  src/pages/TitoloDetail.tsx
   - rimuovere ramo gating: card Firma/Quietanza VociRcaCard sempre presenti
   - rimuovere blocco "Importi semplice" non-RCA
   - passare useAutoTaxFormula e mainVoceObbligatoria in base al ramo

EDIT  src/components/polizze/PremiGaranziaCardShell.tsx
   - aggiungere prop gruppoRamoId
   - dropdown voce filtrato su rca_garanzie.eq(gruppo_ramo_id)
   - state locale righe; layout identico a VociRcaCard

EDIT  src/pages/ImmissionePolizzaPage.tsx
   - passare gruppoRamoId derivato da Sottoramo selezionato a PremiGaranziaCardShell

UPDATE memoria mem://insurance/garanzie-rca-gruppo-ramo
   - generalizzata a "Catalogo garanzie per Gruppo Ramo"
```

## 5. QA

1. Tabelle di Base → "Catalogo Garanzie": filtro per Gruppo Ramo funziona; aggiunta garanzia con gruppo `ZP – R.C.T.` la rende selezionabile in una polizza RCT.
2. Polizza esistente ramo RCT (es. `RG – R.C.T.`) → sezione Importi mostra due card teal/amber con dropdown popolato dalle sole garanzie ZP.
3. Nuova Emissione → seleziona Ramo "ZN – Infortuni" + Sottoramo `IN`: card Firma/Quietanza mostrano dropdown filtrato su garanzie ZN; cambio Sottoramo a un altro gruppo chiede conferma reset.
4. RCA Auto invariato: riga RCA Auto pre-inserita e non rimovibile, formula auto attiva.

## 6. Fuori scopo

- Persistenza vera voci in immissione (Step B sopra).
- Popolamento massivo del catalogo per tutti i gruppi (l'utente lo completerà da Tabelle di Base).
