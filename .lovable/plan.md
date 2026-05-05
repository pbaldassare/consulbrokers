## Obiettivo

Sul tab "Produttori" (`corrispondente`) di `AnagraficheInternePage`:

1. Rendere la **Sede non obbligatoria** (resta selezionabile).
2. Gestire **provvigioni per ramo** (% Provvigione, % Consulenza, % RA) per ciascun Produttore.
3. Generare automaticamente **righe di default** per tutti i rami attivi alla prima apertura.
4. Facilitare la compilazione di massa con **copia/incolla "una colonna in tutte le righe"** e copia rapida del codice/label di ramo.

## Modello dati

Nuova tabella `produttori_provvigioni_ramo`:

| col | tipo |
|---|---|
| id | uuid pk |
| anagrafica_id | uuid fk → `anagrafiche_professionali(id)` ON DELETE CASCADE |
| ramo_codice | text fk → `rami(codice)` |
| percentuale_provvigione | numeric(6,3) |
| percentuale_consulenza | numeric(6,3) |
| percentuale_ra | numeric(6,3) |
| created_at / updated_at | timestamptz |
| UNIQUE (anagrafica_id, ramo_codice) |

RLS: SELECT/INSERT/UPDATE/DELETE per ruoli `admin`, `cfo`, `contabilita`, `responsabile_sede` (allineati alla policy esistente di `anagrafiche_professionali`).

I valori "globali" su `anagrafiche_professionali.percentuale_base/consulenza/ra` restano come **default** del produttore (usati come seed e come fallback se un ramo non è personalizzato).

## Modifiche UI — `AnagraficheInternePage.tsx` (blocco `isCorr`)

### 1. Sede non obbligatoria
- In `renderUfficioSelect`, quando `isProduttore` ed è in render del tab Produttori: rimuovere asterisco `*` e label "Sede *" → "Sede (opzionale)".
- Aggiungere voce "— Nessuna —" nel `Select` che imposta `ufficio_id = null`.
- Rimuovere eventuali validazioni che bloccano il save senza `ufficio_id` per `corrispondente`.

### 2. Tab "Provvigioni" rifatto

Layout:

```text
[ Default produttore ]
% Provvigione [__]   % Consulenza [__]   % RA [__]
[ Applica default a tutti i rami ]   [ Applica solo dove vuoto ]

[ Provvigioni per Ramo ]
Filtro ramo: [search]    [ + Aggiungi ramo ]   [ Mostra solo personalizzati ]

| Ramo (cod — descr) [copy] | % Provv | % Cons | % RA | azioni |
| AR — ALL RISKS       [⧉] | [____]  | [____] | [____] |  🗑   |
...
```

Funzioni:
- **Seed automatico**: alla prima apertura del tab per un produttore senza righe, viene popolato con tutti i rami attivi e i valori di default.
- **Copia label/codice**: bottone icona `Copy` accanto a `codice — descrizione` per copiare in clipboard `AR` o `AR - ALL RISKS` (toggle con tasto destro o secondo bottone).
- **Fill colonna**: in testa a ciascuna colonna `%`, un piccolo pulsante "↓" che applica il valore della prima riga (o un valore digitato in un mini input) a tutte le righe visibili (rispetta il filtro). Variante "solo vuoti".
- **Paste multiriga**: handler `onPaste` sull'input numerico che, se rileva più righe (separate da `\n` o `\t`), distribuisce i valori sulle righe successive partendo dalla cella corrente (compat. Excel/Google Sheets).
- **Mostra solo personalizzati**: filtro che nasconde le righe con valori uguali al default.
- **Reset riga**: 🗑 svuota i 3 campi della riga (torna al fallback).

### 3. Salvataggio

Estendere la mutation di salvataggio del produttore:
- Aggiornare `anagrafiche_professionali` (default).
- Upsert in batch su `produttori_provvigioni_ramo` per le righe modificate.
- Eliminare le righe segnate per reset.

### 4. Lettura nei consumer di provvigione

In tutti i punti che oggi leggono `percentuale_*` dell'anagrafica (es. calcolo provvigioni/PDF EC produttore), introdurre helper:

```ts
getProvvigioneProduttore(anagrafica_id, ramo_codice)
  → ramo-specifica se esiste, altrimenti default produttore
```

Da applicare in:
- `supabase/functions/calcola-provvigioni/index.ts`
- `src/lib/ec-produttore-pdf.ts`
- `src/pages/PagamentoProvvigioneDetail.tsx` / `ProvvigioniMaturatePage.tsx` se rilevanti.

(Refactor incrementale: prima la UI/storage, poi i consumer.)

## File toccati

- **Migration SQL** nuova: tabella + RLS + indici.
- `src/pages/AnagraficheInternePage.tsx`: Sede opzionale, tab Provvigioni nuovo (componente estratto `ProduttoreProvvigioniTab.tsx` per chiarezza).
- `src/components/anagrafiche/ProduttoreProvvigioniTab.tsx` (nuovo).
- `src/lib/getProvvigioneProduttore.ts` (nuovo helper).
- Aggiornamento dei consumer elencati sopra.

## Nuova memoria

Aggiungere `mem://insurance/produttore-provvigioni-per-ramo` con: regola Sede opzionale, tabella `produttori_provvigioni_ramo`, gerarchia ramo-specifica → default produttore, seed automatico.

## Verifica

- Aprire un Produttore senza Sede → salva senza errori.
- Tab Provvigioni mostra tutti i rami attivi seedati con i default.
- Copia/Incolla da Excel di una colonna funziona.
- Bottone "↓" applica valore a tutta la colonna filtrata.
- Calcolo provvigioni usa la % del ramo se presente, altrimenti il default.
