## Bug e incongruenze trovati nell'area Sinistri

### 1. Dati esistenti non collegati al cliente / alla compagnia
- **16/26** sinistri hanno `cliente_anagrafica_id = NULL` pur avendo `titolo_id` valorizzato → in `SinistriList` la colonna *Cliente* mostra "—" e in `SinistriClienteTab` non vengono trovati.
- **26/26** sinistri hanno `compagnia_id = NULL` → in `SinistroDetail` / `SinistriList` la colonna *Compagnia* è sempre vuota.
- Il trigger `trg_sinistri_autopop_cliente_ufficio` lavora solo su INSERT/UPDATE, quindi i record già presenti sono rimasti scollegati.

### 2. Apertura sinistro non uniforme
- `SinistroAperturaWizardPage.tsx` fa una `supabase.from("sinistri").insert(...)` diretta, bypassando l'edge function `gestione-sinistri`:
  - non crea la **checklist di default** (che invece viene creata solo via edge function);
  - non scrive **`log_attivita`** ("creazione_sinistro");
  - hard-coda `stato: "aperto"` invece di passare dal flusso unificato (e nessun evento timeline coerente con i cambi-stato);
  - design diverso dal resto dell'app (`max-w-4xl mx-auto`, card e font custom, niente header con icona arancio coerente con `SinistroDetail` / `ClienteSinistri`).
- `NuovaDenunciaSinistroDialog.tsx` (lato cliente) ugualmente fa insert diretto: corretto (RLS lo richiede col proprio JWT), ma non aggiunge la checklist di default → la pratica nasce "vuota".
- Edge function `gestione-sinistri` schema "crea" dichiara `titolo_id: z.string().uuid()` **obbligatorio non nullable**: se la wizard backoffice (in futuro o per altri entry-point) passasse `titolo_id: null`, fallirebbe.

### 3. Piccoli collegamenti UI
- `SinistroDetail.tsx`: la card "Polizza" naviga a `/titoli/{id}` ma la route reale è `/portafoglio/titoli/{id}` (verificare e allineare).
- `SinistriList.tsx`: il filtro/etichetta dice "Agenzia" ma il dato è `compagnie`. Allineare label a "Compagnia".

---

## Piano di intervento

### A) Migration SQL — backfill + checklist automatica
1. UPDATE `sinistri` SET `cliente_anagrafica_id = titoli.cliente_anagrafica_id` WHERE `cliente_anagrafica_id IS NULL` AND `titolo_id IS NOT NULL`.
2. UPDATE `sinistri` SET `compagnia_id = titoli.compagnia_id` WHERE `compagnia_id IS NULL` AND `titolo_id IS NOT NULL` (con fallback su `titoli.prodotti.compagnia_id` se `titoli.compagnia_id` è null).
3. Estendere `trg_sinistri_autopop_cliente_ufficio` (o nuovo trigger) per popolare anche `compagnia_id` dal `titolo_id`.
4. Nuovo trigger `trg_sinistri_default_checklist` AFTER INSERT: se non esistono righe in `sinistro_checklist` per il sinistro, inserisce le 4 voci di default (denuncia compilata, documentazione fotografica, copia polizza, modulo CID/CAI opzionale). Così sia wizard sia portale cliente partono con la checklist popolata.

### B) Edge function `gestione-sinistri`
- Rendere `titolo_id` nullable nello schema zod "crea".
- Aggiungere nello schema i campi già usati (`data_apertura`, `data_denuncia`, `numero_sinistro_compagnia`, `priorita`, `note_interne`, `importo_riserva`) come opzionali.
- Centralizzare la generazione del `numero_sinistro` se non passato.

### C) `SinistroAperturaWizardPage.tsx` — refactor e restyle
- Sostituire l'insert diretto con `supabase.functions.invoke("gestione-sinistri", { body: { azione: "crea", ... }})`, così da ottenere automaticamente checklist + log + uniformità.
- Allineare header e card al design system già usato in `SinistroDetail` / `ClienteSinistri` (icona rotonda arancio, titolo + sottotitolo, font coerente, larghezza standard del MainLayout invece di `max-w-4xl`).
- Mantenere lo stato iniziale `"aperto"` per pratiche aperte dall'agenzia (cliente resta `"in_valutazione"`).

### D) `SinistriList.tsx`
- Rinominare label "Agenzia" → "Compagnia" (sia nel filtro che nell'header colonna) per coerenza con i dati.
- Correggere il link a polizza in `SinistroDetail` (`/portafoglio/titoli/{id}` se è la route giusta — verificare in `src/routes/portafoglio.tsx`).

### E) Verifica finale
- Aprire SIN-2026-2403 e gli altri 25 record: cliente + compagnia ora popolati, badge stato corretto, link cliente/polizza funzionanti.
- Aprire nuovo sinistro da `SinistroAperturaWizardPage` e da `NuovaDenunciaSinistroDialog`: in entrambi i casi la checklist di default è presente, in `log_attivita` compare l'evento di creazione, il record è visibile alla sede corretta (es. Varese).

### Note tecniche (per lo sviluppatore)
- Il refactor del wizard verso l'edge function evita anche problemi RLS futuri (oggi passa solo perché chi crea è di solito admin/ufficio con `ufficio_id` corrispondente).
- I trigger e i backfill non toccano i record-ancora elencati nella memoria di progetto (`204366651`, `6131402092`, `RCM00010074404`) perché vivono sulla tabella `titoli`, non su `sinistri`.
- Nessuna modifica allo schema `auth/storage`; solo `public.sinistri` + nuovi trigger su `public.sinistri`.
