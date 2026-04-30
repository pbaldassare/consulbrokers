## Obiettivo

1. Aggiungere campi **CAP**, **Città** e **Provincia** strutturati alla gestione Sedi (tabella `uffici`).
2. Confermare l'unificazione **Sedi = Filiali**: a livello UI le Filiali sono già state rimosse (memo `filiali-deprecated`); resta solo da chiudere il cerchio aggiornando la documentazione e verificando che non ci siano residui visibili.

## 1. Database — Migrazione `uffici`

Aggiungere 3 colonne strutturate a `public.uffici` (oggi c'è solo `indirizzo` text monolitico):

```sql
ALTER TABLE public.uffici
  ADD COLUMN IF NOT EXISTS cap text,
  ADD COLUMN IF NOT EXISTS citta text,
  ADD COLUMN IF NOT EXISTS provincia text;
```

**Backfill** (one-shot via insert-tool con UPDATE) per le 2 sedi esistenti, parsando `indirizzo`:
- `Ufficio di Napoli` → `via mergellina 2` (CAP/città/prov vuoti, da compilare manualmente)
- `SEDE SAN DONA' DI PIAVE` → indirizzo già strutturato `Via Giobatta dall'Armi 3/2, 30027 San Donà di Piave (VE)` → estrarre cap=`30027`, citta=`San Donà di Piave`, provincia=`VE` e lasciare `indirizzo` con la sola via = `Via Giobatta dall'Armi 3/2`.

Si manterrà comunque la colonna `indirizzo` come campo "via + civico" (street line). Le altre 3 vivranno separate.

## 2. UI — `src/components/anagrafiche/SediManager.tsx`

### Form (Dialog Crea/Modifica)

- Sostituire l'unico campo "Indirizzo" con quattro campi:
  - **Indirizzo** (via + civico) — usa `AddressAutocomplete`. Quando l'utente seleziona un suggerimento Google, popolare automaticamente `cap`, `citta`, `provincia` (l'autocomplete già restituisce questi componenti tramite `onSelect`).
  - **CAP** (Input, max 5 cifre)
  - **Città** (Input)
  - **Provincia** (Input, max 2 lettere, uppercase)
- Layout: Indirizzo a riga intera; sotto una griglia `grid-cols-3` con CAP / Città / Provincia.
- Aggiornare `formData`, `openCreateDialog`, `openEditDialog`, `upsertMutation` per gestire i 3 nuovi campi.

### Tabella elenco Sedi

Mostrare l'indirizzo composto in colonna unica:
```
{indirizzo}, {cap} {citta} ({provincia})
```
filtrando i pezzi vuoti (così le sedi vecchie non si rompono).

### Card "Dettaglio Sede"

Stessa composizione testuale per il riepilogo in alto.

## 3. Aggiornamenti collegati

- **`src/pages/DocPrecontrattualePage.tsx`**: la funzione `parseIndirizzoSede(u.indirizzo)` resta, ma prima preferiamo i campi strutturati se presenti:
  ```ts
  const applySede = (id) => {
    const u = ufficiList?.find(x => x.id === id);
    if (!u) return;
    if (u.cap || u.citta || u.provincia) {
      setIndirizzoRui(u.indirizzo || "");
      setCapRui(u.cap || "");
      setCittaRui(u.citta || "");
      setProvinciaRui(u.provincia || "");
    } else {
      // fallback al parser legacy
      const p = parseIndirizzoSede(u.indirizzo);
      ...
    }
  };
  ```
  Aggiornare anche la query `uffici-list-doc` per selezionare `id, nome_ufficio, indirizzo, cap, citta, provincia`.

## 4. Sedi = Filiali — verifica e memoria

- Lo stato attuale (memo `filiali-deprecated.md`) conferma che la voce "Filiali" è già stata rimossa da: Tabelle Base, Anagrafica Cliente, Rinnovi, DocPrecontrattuale.
- Nessun nuovo punto UI espone `filiale`. Il check `rg -li "filial"` su `src/` restituisce solo `src/integrations/supabase/types.ts` (auto-generato dal DB, non si tocca).
- **Nessuna azione codice ulteriore** sul fronte unificazione: l'unica entità Sede in UI è già `uffici`. Aggiorno la memoria per ribadire che CAP/Città/Provincia ora vivono su `uffici` e non su `filiali`.

## 5. Versione

Bump `public/version.json`.

## File toccati

- migrazione DB (ALTER + UPDATE backfill)
- `src/components/anagrafiche/SediManager.tsx`
- `src/pages/DocPrecontrattualePage.tsx`
- `public/version.json`
- memoria: aggiornamento `mem://insurance/filiali-deprecated` (aggiunge nota su nuovi campi strutturati)

## Note

- Niente CHECK constraint su CAP/Provincia per non bloccare dati legacy; si valida solo lato form (CAP 5 cifre, Provincia 2 lettere maiuscole).
- I campi sono nullable: le sedi esistenti continuano a funzionare anche senza CAP/Città/Provincia compilati.

Confermi?
