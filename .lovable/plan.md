

## Fix focus loss su input + Auto-fill CF completo + Combobox comuni per Luogo di Nascita

### Problemi rilevati

1. **Cursore esce dopo il primo carattere** in tutti gli input (Indirizzi Aggiuntivi, Codice Ricerca, Email, ecc.). Causa: `FieldInput`, `FieldSelect`, `FieldAddress`, `FieldHint`, `FieldDisplay`, `RequiredMark` sono dichiarati **dentro** il body del componente `ClienteDetailContent` (righe 949–1123). Ad ogni keystroke React vede una nuova reference della funzione → smonta il sotto-albero e rimonta l'`<Input>` → il browser perde il focus. Stesso bug noto su tutta la pagina, non solo "Indirizzi Aggiuntivi".

2. **Auto-fill CF parziale**: `handleCFAutoFill` (riga 953) popola solo `sesso`, `data_nascita`, `comune_nascita`, `provincia_nascita` ma **NON** popola `luogo_nascita` (campo UI mostrato in screenshot) né forza il valore quando già presente. Risultato: l'utente digita CF valido (es. `BBTNDR71R12F839C` → Monza) ma il campo "Luogo di Nascita" resta vuoto.

3. **Luogo di Nascita è un text libero**: l'utente deve digitare a mano. Va trasformato in **combobox cercabile** sull'elenco dei comuni italiani noti (dataset `COMUNI` in `src/lib/comuniItaliani.ts`), con possibilità di digitare comunque testo libero per fallback (comuni non in dataset / esteri).

### Cosa modifico

**File unico: `src/pages/ClienteDetail.tsx`**

#### 1. Estrazione componenti fuori dal body (fix focus loss)

Sposto `FieldDisplay`, `FieldInput`, `FieldSelect`, `FieldSwitch`, `FieldAddress`, `FieldHint`, `RequiredMark` come componenti **module-level** (fuori da `ClienteDetailContent`). Per dargli accesso a `ef`, `readOnly`, `updateField`, `isFieldRequired`, `isFieldMissing`, `handleCFAutoFill`, li passo via **props esplicite** (oppure tramite un context locale per ridurre il boilerplate). Soluzione che preferisco: **piccolo Context** `<AnagraficaFormCtx>` con `{ ef, readOnly, updateField, isFieldRequired, isFieldMissing, isAziendaIdMissing, handleCFAutoFill }`, providato in cima al `TabsContent value="anagrafica"`. I componenti consumano via `useContext`. Risultato: reference stabili tra render → niente unmount → focus preservato per tutta la digitazione.

#### 2. Combobox comuni per "Luogo di Nascita"

Aggiungo un nuovo componente `FieldComuneItaliano` (module-level) basato su `SearchableSelect` esistente:
- Options derivate da `COMUNI` (esporto un array `COMUNI_OPTIONS = [{ value: "Napoli (NA)", label: "Napoli (NA)" }, …]` da `src/lib/comuniItaliani.ts` ordinato alfabeticamente).
- `allowCustom`: se l'utente digita un valore non in lista, lo accetta come testo libero (es. "Parigi" o un comune piccolo non mappato). `SearchableSelect` ha già la prop o la aggiungo se mancante (verifico durante implementazione, fallback: uso un `Combobox` Popover+Command custom inline).
- Sostituisce `FieldInput label="Luogo di Nascita"` (riga 1332) solo per privati.

#### 3. Auto-fill CF completo

Aggiorno `handleCFAutoFill`:
- Popola anche `luogo_nascita` con `${info.comune} (${info.provincia})` quando vuoto.
- Modalità "force overwrite": se l'utente sta digitando un nuovo CF e i campi auto-derivati erano stati popolati da un CF precedente, li sovrascrivo (così cambiando CF si aggiorna tutto). Confronto con i valori attesi del CF precedente per capire se "auto-popolato" → se match, sovrascrivo; se difforme, lascio (l'utente li ha modificati a mano) e mostro il warning di coerenza già presente.
- Toast invariato.

#### 4. Pulizia

Rimuovo le definizioni duplicate dei componenti dal body di `ClienteDetailContent`. Mantengo invariate: validazione obbligatori, hint coerenza CF, blocco Salva, mutation, RLS, schema DB, altri tab.

### Cosa NON tocco

- `src/components/AddressAutocomplete.tsx`: l'`Input` interno usa `useRef` proprio, il problema non è suo — sparisce automaticamente quando il wrapper esterno smette di rimontare.
- `src/lib/parseCF.ts`, `src/lib/comuniItaliani.ts`: aggiungo solo l'export `COMUNI_OPTIONS` al secondo file (non breaking).
- Schema DB, RLS, Edge Functions, altri tab/pagine.
- `SearchableSelect.tsx`: lo riuso così com'è.

### Verifica

1. Vai su `/archivi/clienti/<id>` → Anagrafica → Modifica. Digita in "Codice Ricerca" 10 caratteri di fila → tutti compaiono, cursore non esce. Stesso test su Email, Telefono, CAP, Indirizzo Alternativo (campi che oggi perdono il focus).
2. Cancella il CF e digita `BBTNDR71R12F839C` → si auto-popolano Data di Nascita (12/10/1971), Luogo di Nascita ("Monza (MB)") con il combobox preselezionato. Cambia il CF in `RSSMRA80A01H501U` → tutti i campi auto-derivati si aggiornano (Data 01/01/1980, Luogo "Roma (RM)").
3. Sul Luogo di Nascita: clicca → vedi lista cercabile dei comuni italiani. Digita "nap" → filtro mostra Napoli. Digita un comune fuori lista (es. "San Giorgio a Cremano") → posso comunque salvarlo come testo libero.
4. Lascia vuoto un campo obbligatorio → bordo rosso + hint + Salva disabilitato (regressione zero).
5. Modifica Data di Nascita in modo divergente dal CF → warning giallo "Data non coerente" come prima.

