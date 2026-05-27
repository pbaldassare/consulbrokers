# Estrazione dati veicolo nell'Import AI (Polizza Auto)

## Obiettivo
Nel dialog "Importa polizza da PDF (AI)" l'utente deve poter dire esplicitamente "è una polizza auto" anche quando il Ramo non è ZQ, e in entrambi i casi (flag attivo **oppure** ramo R.C.A.) l'AI deve estrarre i dati veicolo/conducente **solo se presenti nel PDF**, senza inventarli. All'apply, il form Immissione apre automaticamente la sezione RCA Auto e popola solo i campi trovati.

## Modifiche

### 1. `src/components/polizze/ImportNuovaPolizzaAIDialog.tsx`
- Aggiungere uno **Switch "Polizza Auto"** nello step Setup, sotto/accanto al selettore Ramo. Stato locale `forzaPolizzaAuto: boolean`, default `false`.
- Auto-attivazione: quando l'utente seleziona un Ramo del gruppo `ZQ`, lo switch viene messo a `true` automaticamente (e resta editabile, in modo che l'utente possa forzarlo anche su rami non-ZQ — es. infortuni conducente legato a un veicolo).
- Passare il flag alla edge function nel body (`forza_veicolo: boolean`).
- Nella `MatchResult` aggiungere `polizzaAuto?: boolean` (= `forzaPolizzaAuto || isZQ`), così la pagina sa che deve aprire la sezione auto anche se il Ramo non è ZQ.
- Nello step Summary mostrare le card "Veicolo" e "Conducente" **solo se** ci sono effettivamente campi popolati (logica `hasVeicolo`/`hasConducente` già presente); nessun campo inventato, niente placeholder.

### 2. `supabase/functions/parse-polizza-completa/index.ts`
- Accettare nel body un nuovo parametro `forza_veicolo: boolean`.
- Estendere la condizione che oggi è solo `isZQ` a `shouldExtractVeicolo = isZQ || forza_veicolo`.
- Quando `shouldExtractVeicolo === true`: aggiungere al prompt le istruzioni esistenti per il blocco `veicolo`/`conducente`, **ma** rafforzare che i campi vanno compilati **solo se realmente presenti nel testo del PDF** (no allucinazioni: targa, telaio, marca, modello, classe BM, cv/kw/cc, posti, alimentazione, immatricolazione, provincia, uso). Se un campo non è scritto, lasciarlo `undefined`.
- Quando `shouldExtractVeicolo === false`: lo schema tool resta uguale ma il prompt dice esplicitamente di **non** compilare i blocchi `veicolo`/`conducente`.

### 3. `src/pages/ImmissionePolizzaPage.tsx`
- In `handleAIImportApply`:
  - Se `match.polizzaAuto === true` → `setPolizzaAuto(true)` (apre la sezione RCA anche se il ramo selezionato non è ZQ).
  - Mantenere la logica già presente: per ogni campo `v*`/`c*` settare lo stato **solo se** il valore corrispondente è presente in `parsed.veicolo`/`parsed.conducente` (nessun reset di campi non forniti).
  - L'ordine resta: prima `setPolizzaAuto(true)` → poi al tick successivo (microtask) il `useEffect([isRCA])` non azzera i dati appena impostati (già gestito perché i set veicolo arrivano dopo).

### 4. `public/version.json`
- Bump timestamp.

## Fuori scope
- Nessuna nuova tabella o campo DB.
- Niente sezioni Vita/Trasporti.
- Nessun cambio alla UI manuale di Immissione oltre all'apertura automatica della sezione RCA.

## Test rapidi
1. Ramo ZQ + PDF RCA con targa → veicolo e conducente popolati, sezione RCA aperta.
2. Ramo non-ZQ (es. Infortuni) + Switch Polizza Auto ON + PDF con targa → veicolo popolato, sezione RCA aperta.
3. Ramo ZQ + PDF senza dati veicolo leggibili → nessun campo inventato, sezione aperta ma vuota.
4. Ramo non-ZQ + Switch OFF → nessun blocco veicolo in output, sezione RCA chiusa.
