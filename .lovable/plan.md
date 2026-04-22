

## Flag booleano "Tacito Rinnovo" sulle polizze

### Cosa cambia

Aggiungo una colonna `tacito_rinnovo BOOLEAN NOT NULL DEFAULT true` su `titoli`. La popolo una volta dai dati esistenti (`T` e `tacito_rinnovo` → true, tutti gli altri valori → false). Da qui in avanti la UI mostra/edita uno **switch Sì/No** invece di un campo testo libero. Il vecchio campo `tipo_rinnovo` resta a DB **intoccato** (come richiesto: "il resto lascialo ignorato").

### Migrazione DB

1. `ALTER TABLE titoli ADD COLUMN tacito_rinnovo boolean NOT NULL DEFAULT true;`
2. UPDATE iniziale (via insert tool):
   - `tacito_rinnovo = true` se `tipo_rinnovo IN ('T','tacito_rinnovo')` → 250 polizze
   - `tacito_rinnovo = false` per tutti gli altri valori non nulli (`A,R,S,J,D,X,V`) → 797 polizze
   - polizze con `tipo_rinnovo NULL` restano `true` (default)
3. Stessa colonna `tacito_rinnovo boolean` su `movimenti_polizza` con stesso UPDATE iniziale (per coerenza storica), default true.

Nessun trigger, nessun constraint: è un semplice booleano.

### Frontend

- **`src/pages/TitoloDetail.tsx`**
  - Nel form Periodo, sostituisco il campo "Tipo Rinnovo" (oggi `SearchableSelect` con `[tacito_rinnovo, scadenza_annuale, disdetta]`) con un componente `Switch` (shadcn) etichettato "Tacito Rinnovo" (Sì/No), bound a `tacito_rinnovo: boolean`.
  - Nella vista read-only, sostituisco `<FieldRow label="Tipo Rinnovo" value={fmt(t.tipo_rinnovo)} />` con `<FieldRow label="Tacito Rinnovo" value={t.tacito_rinnovo ? 'Sì' : 'No'} />`.
  - Salvataggio: invio `tacito_rinnovo` (boolean) nell'UPDATE; non tocco più `tipo_rinnovo`.

- **`src/pages/ImmissionePolizzaPage.tsx`**
  - Sostituisco lo state `tipoRinnovo` (string) con `tacitoRinnovo: boolean` (default `true`).
  - Sostituisco il `SearchableSelect` con uno `Switch` "Tacito Rinnovo" (Sì/No, default Sì).
  - Nell'INSERT del titolo invio `tacito_rinnovo: tacitoRinnovo`. Rimuovo la riga 541 con la conversione manuale `tipo_rinnovo === "tacito_rinnovo" ? "Tacito rinnovo" : ...`.

- **`src/components/polizze/RinnovoTitoloDialog.tsx`**
  - Quando duplico il titolo padre nel rinnovo, copio anche `tacito_rinnovo: t.tacito_rinnovo` (il default `true` copre i casi in cui il padre fosse null).

- **`supabase/functions/ai-assistant/schema-context.ts`**
  - Aggiungo `tacito_rinnovo (boolean, default true)` nell'elenco campi `titoli` con nota: "true = polizza a tacito rinnovo, false = scadenza naturale/disdetta".

### Cosa NON tocco

- Non rinomino, non normalizzo e non leggo più `tipo_rinnovo` da UI: resta a DB con i suoi valori legacy (`A, T, R, S, J, D, X, V, tacito_rinnovo`) per audit/storico.
- Nessuna lookup `tipi_rinnovo`, nessun trigger di validazione, nessuna modifica a Edge Function di import.
- Nessun cambio a logica scadenze/disdetta/rinnovo: è solo un'etichetta booleana esposta in UI e salvata.

### Memory

Salvo `mem://insurance/tacito-rinnovo-flag`: la verità per "tacito rinnovo sì/no" è `titoli.tacito_rinnovo` (boolean, default true). `tipo_rinnovo` è legacy, da ignorare lato UI.

### Verifica

1. Apro il titolo `RCM20080078032` (`/titoli/ee7fcdcf-...`): nel pannello Periodo vedo lo Switch "Tacito Rinnovo" su **Sì** (perché legacy era `T`).
2. Apro un titolo con `tipo_rinnovo='A'`: lo Switch è su **No**.
3. Cambio lo Switch e salvo: `titoli.tacito_rinnovo` aggiornato, `tipo_rinnovo` invariato.
4. Creo una nuova polizza da `ImmissionePolizzaPage`: lo Switch è su **Sì** di default; salvando, `tacito_rinnovo=true` a DB.
5. Faccio un Rinnovo: il nuovo titolo eredita il `tacito_rinnovo` del padre.
6. AI Assistant: `SELECT COUNT(*) FROM titoli WHERE tacito_rinnovo = true` restituisce 250 + le NULL legacy promosse a true (≈ totale tacito rinnovo).

