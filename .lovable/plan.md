## Obiettivo
Aggiungere un **import AI di polizza da PDF** alla pagina "Nuova Emissione" (`/portafoglio/immissione`). L'utente carica una scheda di polizza (es. AmTrust Colpa Grave testato), il sistema la analizza con AI, riconosce cliente/compagnia e pre-compila tutti i campi del form.

## Flusso utente

1. In cima alla pagina **Immissione Polizza** appare una card "📄 Importa da PDF (AI)".
2. L'utente trascina/seleziona il PDF della scheda di polizza.
3. Spinner "Analisi in corso…" → l'edge function chiama Gemini via Lovable AI Gateway.
4. Modale di **anteprima e conferma** con:
   - **Cliente**: match automatico per CF/P.IVA → se trovato mostra il cliente esistente con badge "✅ Cliente esistente"; se non trovato propone "🆕 Crea nuovo cliente" con dati precompilati (Nome, CF, Indirizzo, Comune, Prov, CAP, Nazione).
   - **Compagnia**: match fuzzy su `compagnie.denominazione` → mostra match con confidence; se nessun match, propone selezione manuale.
   - **Ramo / Sottoramo**: AI suggerisce un mapping (es. "RC Professionale Medico" → gruppo `ZP` / sottoramo `RC PATRIMONIALE`); utente può correggere.
   - **Dati polizza**: numero, decorrenza, scadenza, frazionamento, tacito rinnovo, prossima quietanza.
   - **Premi firma + quietanza**: netto, accessori, tasse, lordo (entrambe le quote).
   - **Garanzie**: lista con descrizione + massimale (per polizze RC/professionali) → mappate sul catalogo `rca_garanzie` filtrato per gruppo ramo.
5. L'utente clicca **"Conferma e compila form"** → tutti i campi vengono iniettati nello stato della pagina Immissione (cliente, sede, contratto, premi, garanzie). L'utente può rifinire e poi salvare normalmente.

## Dati estratti dal PDF di test (validazione mapping)

```
Polizza: RCM20080076069 | Compagnia: AmTrust Assicurazioni
Contraente: GIUSEPPE AMUSO | CF: MSAGPP56M06C351X
Indirizzo: VIA FELICE PARADISO 3, CATANIA (CT) 95121 IT
Decorrenza: 12/01/2026 | Scadenza: 12/01/2027 | Frazionamento: Annuale | Tacito Rinnovo: SÌ
Premi: Netto 376,27 | Imposte 83,73 | Lordo 460,00 (firma = quietanza = annuo)
Ramo: RC Professionale Medico (Colpa Grave) → suggerimento ZP / RC PATRIMONIALE
Garanzia attiva: "Garanzia Base II (Colpa Grave): Dipendente Privato" | Massimale 5.000.000
```

## Componenti tecnici

**Nuova edge function `parse-polizza-generica`** (basata su `parse-polizza-rca` esistente):
- Input: `{ fileBase64, mimeType }`.
- Modello: `google/gemini-2.5-flash` (già usato in `parse-polizza-rca`, `parse-provvigioni-pdf`).
- Tool/JSON schema esteso che copre: contraente (nome, CF, P.IVA, indirizzo completo), assicurato (se diverso), compagnia, intermediario/codice nodo, polizza (numero, decorrenza, scadenza, frazionamento, tacito rinnovo, prossima quietanza), premi firma + rate future, ramo/prodotto, garanzie (descrizione, massimale, sottolimiti).

**Lookup nel client (post-AI)**:
- Cliente: query `clienti` per `codice_fiscale` o `partita_iva` (esatto, uppercase).
- Compagnia: query `compagnie` con ILIKE su denominazione, mostrare top 3 risultati ordinati.
- Ramo: query `rami` + `gruppi_ramo` con ILIKE su descrizione restituita dall'AI.

**Nuovo componente `ImportPolizzaAIDialog.tsx`**:
- Dropzone PDF (max 10MB).
- Stati: idle / uploading / parsing / preview / done.
- Sezioni di review con override manuale per ogni campo dubbio.
- Pulsante "Applica al form" che chiama una callback `onImportComplete(data)` esposta dalla pagina Immissione.

**Modifica `ImmissionePolizzaPage.tsx`**:
- Card "Importa da PDF (AI)" sopra "Cliente & Sede" (collassabile).
- Handler che riceve i dati confermati e li scrive negli stati esistenti (cliente_id, contratto, premi, garanzie).

## Out of scope (questo round)
- Salvataggio automatico del PDF originale come allegato della polizza (proposta come step successivo).
- Feedback loop / training: nessuna persistenza delle correzioni utente sul catalogo per ora.
- Import di documenti diversi dalla scheda di polizza (es. quietanze, appendici).
- OCR pre-elaborazione: ci affidiamo direttamente alla capacità multimodale di Gemini sui PDF nativi.

## QA
- PDF AmTrust di test → tutti i campi sopra estratti correttamente; cliente CF `MSAGPP56M06C351X` proposto come "nuovo" (verificare che non esista già); compagnia "AmTrust Assicurazioni" matchata.
- Test con PDF RCA (riusa il medesimo dialog, garanzie multiple).
- Test con PDF danneggiato/illeggibile → messaggio d'errore chiaro.

Dopo conferma del piano implemento edge function, dialog, e integrazione nella pagina.
