# Selezione Rapporto Agenzia in fase di emissione titolo

## Obiettivo
Quando l'**Agenzia di Riferimento** scelta in immissione titolo ha **più di un rapporto attivo** in `compagnia_rapporti`, l'utente deve poter scegliere quale rapporto stiamo usando per quella polizza. Il **codice rapporto** deve essere salvato sul titolo e mostrato nell'anagrafica della polizza.

## Verifica DB
- `compagnia_rapporti` esiste già con: `id`, `compagnia_id`, `gruppo_compagnia_id`, `codice_rapporto`, `tipo_rapporto`, `attivo`, `rami_abilitati`, ecc. (memoria: "Rapporti agenzia-compagnia N:N").
- `titoli` oggi ha solo `compagnia_id` → manca il riferimento al rapporto specifico.
- Esempio reale: la compagnia `90a1b14…` ha 2 rapporti attivi → caso reale di ambiguità.

## Migrazione DB
Aggiungere a `titoli`:
- `compagnia_rapporto_id uuid NULL REFERENCES compagnia_rapporti(id) ON DELETE SET NULL`
- `codice_rapporto text NULL` (denormalizzato per visualizzazione veloce in liste/PDF)
- Index su `compagnia_rapporto_id`.

Nessun backfill: i titoli esistenti restano `NULL` (legacy, in TitoloDetail si potrà comunque editare a posteriori).

## ImmissionePolizzaPage
1. Caricare `compagnia_rapporti` per `selectedCompagnia` (filtro `attivo=true`) con React Query.
2. Logica:
   - **0 rapporti** → nessun campo extra; salva `compagnia_rapporto_id=NULL`, `codice_rapporto=NULL`.
   - **1 rapporto** → auto-selezionato in silenzio; salva id + `codice_rapporto` (mostra solo una riga read-only "Rapporto: COD - tipo").
   - **≥ 2 rapporti** → mostra subito sotto "Agenzia di Riferimento" un nuovo `SearchableSelect` **"Rapporto Agenzia *"** (obbligatorio, bordo amber se vuoto) con opzioni `${codice_rapporto} - ${tipo_rapporto}`.
3. Il salvataggio del titolo include `compagnia_rapporto_id` e `codice_rapporto`. Validazione blocca il salvataggio se l'agenzia ha ≥2 rapporti e l'utente non ha scelto.
4. Quando si cambia agenzia → reset di `compagnia_rapporto_id`/`codice_rapporto`.

## TitoloDetail (anagrafica polizza)
- Read-only: aggiungere `FieldRow label="Codice Rapporto" value={t.codice_rapporto || "—"}` accanto a "Agenzia / Agenzia di rif.".
- Edit Contratto: aggiungere `SearchableSelect` "Rapporto Agenzia" che si popola in base a `contrattoForm.compagnia_id` e segue le stesse regole (0/1/≥2). Salva `compagnia_rapporto_id` + `codice_rapporto` nel `update`.

## "Valida per tutti i soggetti"
Le altre pagine di lifecycle (Rinnovo, Duplicazione, Riattivazione, Sospensione, Storno, Appendici) creano nuovi titoli ereditando dal titolo origine: copieranno automaticamente `compagnia_rapporto_id` e `codice_rapporto` quando copiano `compagnia_id`. L'utente può comunque modificarli da TitoloDetail. Nessuna UI extra in queste pagine in questa iterazione (richiederebbero la stessa selezione condizionale; se serve si può aggiungere in un secondo giro).

## Memoria
Aggiornare `mem://insurance/compagnia-rapporti-multipli` con la nuova relazione `titoli.compagnia_rapporto_id` e regola UX (0/1/≥2 rapporti).

## Out of scope
- Backfill dei titoli esistenti.
- Cambi UX nelle pagine di lifecycle (solo eredità campo).
- Validazione cross con `rami_abilitati` del rapporto (può essere step successivo).
