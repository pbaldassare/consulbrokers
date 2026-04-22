

## Campo "Prodotto" come testo libero salvato in DB

### Situazione attuale

- Il campo "Prodotto" in UI è un `SearchableSelect` legato alla tabella lookup `prodotti` (filtrata per compagnia), che salva su `titoli.prodotto_id` (uuid).
- Verifica DB: **0 polizze su 1047 hanno `prodotto_id` valorizzato** → la lookup non viene mai usata in pratica.
- A DB esiste già una colonna `titoli.prodotto_nome (text)` con 7 valori reali (es. "Cyber Risk", "Tutela Legale", "Kasko Veicoli") + è già copiata da `RinnovoTitoloDialog.tsx` durante i rinnovi.
- Conclusione: la verità per "Prodotto" diventa `prodotto_nome` (text). `prodotto_id` resta a DB come legacy ma non viene più scritto/letto da UI.

### Modifiche

**1. `src/pages/TitoloDetail.tsx`**
- Sezione Contratto, blocco edit: sostituisco lo `SearchableSelect` "Prodotto" con un `<Input type="text" placeholder="Es. Tutela Legale, Cyber Risk…" />` bound su `contrattoForm.prodotto_nome`.
- Stato del form: rimuovo `prodotto_id` (resta inalterato a DB), aggiungo `prodotto_nome: string` (default `""`).
- Salvataggio (UPDATE su `titoli`): invio `prodotto_nome: contrattoForm.prodotto_nome || null`. Non tocco più `prodotto_id`.
- Vista read-only: `<FieldRow label="Prodotto" value={fmt(t.prodotto_nome || t.prodotti?.nome_prodotto)} />` (fallback alla lookup solo per i pochi storici che fossero collegati per id).
- Header titolo (riga 1068): aggiorno il sottotitolo a `t.prodotto_nome ?? t.prodotti?.nome_prodotto ?? ""` per mostrare il nuovo campo.
- Rimuovo la query `prodottiOpts` (non più necessaria) e relativo useEffect dipendente da `compagnia_id`.

**2. `src/pages/ImmissionePolizzaPage.tsx`**
- Sostituisco lo state `selectedProdotto` (uuid) con `prodottoNome: string` (default `""`).
- Form: sostituisco il `SearchableSelect` Prodotto con un `<Input type="text" placeholder="Nome prodotto (testo libero)" />`.
- INSERT su `titoli`: rimuovo `prodotto_id: selectedProdotto`, aggiungo `prodotto_nome: prodottoNome || null`.
- **Provvigione automatica**: oggi la lookup provvigione usa `selectedProdottoCategoriaId` derivato dal prodotto scelto. Senza più la lookup `prodotti`, la categoria non è più derivabile → l'utente dovrà selezionare manualmente la categoria/ramo come oggi avviene già tramite `selectedRamo`. Modifico `provvigioneDb` per usare `categoria_id` ricavata dal **ramo selezionato** (`rami.categoria_id` se esiste, altrimenti rimuovo la chiamata silente). Mantengo le card di conferma/aggiornamento provvigione ma legate al ramo.

**3. `src/components/polizze/RinnovoTitoloDialog.tsx`**
- Già copia `prodotto_nome` (riga 201). Nessuna modifica strutturale; rimuovo la riga 200 che copia `prodotto_id` per allinearci al fatto che il campo non viene più usato.

**4. `supabase/functions/ai-assistant/schema-context.ts`**
- Aggiungo nota su `titoli.prodotto_nome (text)`: "nome prodotto in testo libero (verità UI). `prodotto_id` è legacy, non usato".

**5. Memory**
- Salvo `mem://insurance/prodotto-nome-libero`: il prodotto polizza è un campo testo libero su `titoli.prodotto_nome`. La FK `prodotto_id` → `prodotti` è legacy: non leggere/scrivere da UI. La provvigione automatica per ramo passa solo per `rami.categoria_id`.

### Cosa NON tocco

- Non droppo `titoli.prodotto_id` né la tabella `prodotti` (resta per audit/storico ed eventuale futura riattivazione).
- Nessun cambio a `prodotti` o alla pagina che gestisce la lookup, se esiste.
- `ClientePolizze.tsx` e `TemplatePage.tsx` già leggono `prodotto_nome`: nessuna modifica necessaria.
- Nessun trigger, nessun constraint sul nuovo campo testo.

### Verifica

1. Apro `/titoli/ab2c7fd2-…`, premo "Modifica" sezione Contratto: vedo un campo testo "Prodotto" vuoto (perché il record non ha `prodotto_nome`). Scrivo "Tutela Legale", salvo → DB `titoli.prodotto_nome = 'Tutela Legale'`.
2. Riapro il titolo: il campo mostra "Tutela Legale" sia in read-only che in edit.
3. Vado in `/immissione-polizza`: nel form vedo `Input` testo invece del select; salvando, la nuova polizza ha `prodotto_nome` valorizzato e `prodotto_id` NULL.
4. Faccio Rinnovo da un titolo con `prodotto_nome = 'Cyber Risk'`: il nuovo titolo eredita il testo.
5. Portale cliente `/cliente/polizze`: continua a mostrare `prodotto_nome` come oggi (codice già pronto).
6. AI Assistant: la query `SELECT prodotto_nome, COUNT(*) FROM titoli GROUP BY prodotto_nome` restituisce risultati significativi (non più tutti NULL).

