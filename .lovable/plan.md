## Più dati strutturati dalle CGA

Dal PDF allegato (REVO Cyber Risk – polizza OX00085594) emerge che `parse-cga` oggi cattura solo: nome prodotto, compagnia, ramo, garanzie con massimale/franchigia/scoperto, condizioni e un sommario. Stiamo perdendo dati ad alto valore che il PDF espone in chiaro.

Il principio di separazione resta: **dati generici** sul prodotto (condivisi) vs **dati personali** sulla singola polizza (per cliente, RLS esistente).

### Nuovi dati GENERICI (in `prodotti_cga` + tabelle figlie)

Aggiunte a `prodotti_cga`:
- `codice_modello` (es. `Mod. R040 Ed. 01.2026`)
- `compagnia_email_servizio_clienti`, `compagnia_url_area_personale`
- `forma_copertura` (`claims_made` / `loss_occurrence` / `primo_rischio` / `secondo_rischio`)
- `periodo_retroattivita_mesi`
- `massimale_aggregato_annuo`
- `note_legali` (riferimenti normativi rilevanti, es. art. 1917 c.c., L. 136/2010)

Nuova tabella `prodotti_definizioni` (glossario CGA):
- `prodotto_id`, `termine`, `definizione`

Estensione di `prodotti_garanzie`:
- `sottolimite` (numeric), `franchigia_temporale_giorni` (int), `aggregato_annuo` (numeric), `ambito_territoriale` (text)

### Nuovi dati PERSONALI (in `polizza_cga` + figlia)

Aggiunte a `polizza_cga`:
- `numero_polizza` (dal PDF)
- `contraente_ragione_sociale`, `contraente_piva`, `contraente_cf`, `contraente_indirizzo`, `contraente_cap`, `contraente_comune`, `contraente_provincia`, `contraente_email`
- `assicurato_descrizione` (quando ≠ contraente)
- `data_decorrenza`, `data_scadenza`, `data_emissione`, `tacito_rinnovo` (bool)
- `cig`, `cup`
- `frazionamento` (testo: Annuale/Semestrale/…)
- `intermediario_nome`, `intermediario_indirizzo`, `intermediario_telefono`, `intermediario_email`
- `premio_imponibile_totale`, `premio_imposte_totale`, `premio_lordo_totale`
- `premio_rata_sottoscrizione_lordo`, `premio_rate_successive_lordo`

Nuova tabella `polizza_cga_premio_garanzia` (composizione premio per garanzia, sia "rata sottoscrizione" che "rate successive"):
- `polizza_cga_id`, `garanzia` (text), `tipo_rata` (`sottoscrizione`/`successiva`), `imponibile`, `imposte`, `lordo`

### Modifiche tecniche

1. **Migration** (4 step):
   - `ALTER TABLE prodotti_cga ADD …` (nuovi campi)
   - `ALTER TABLE prodotti_garanzie ADD …`
   - `ALTER TABLE polizza_cga ADD …`
   - `CREATE TABLE prodotti_definizioni` + `polizza_cga_premio_garanzia` con `GRANT` e RLS (stesso pattern delle tabelle esistenti)

2. **Edge function `parse-cga`**: aggiornare lo schema JSON richiesto a Gemini per emettere i nuovi campi, mantenendo back-compat (tutto opzionale).

3. **`AnalizzaPolizzaCgaDialog.tsx`**: estendere il tipo `ExtractedData`, mostrare 3 nuove card (Anagrafica Polizza, Intermediario, Composizione Premio) prima del salvataggio, e persistere i nuovi campi nelle insert.

4. **`LibreriaCgaDetailDialog`** + `useLibreriaCga`: aggiungere sezioni accordion *Definizioni/Glossario*, *Forma di copertura*, *Info compagnia*. I dati personali non vengono mostrati qui.

5. **Scheda cliente — `PolizzeCgaSection`**: aggiungere mini-card di sintesi (numero polizza, decorrenza/scadenza, CIG, premio lordo, intermediario).

### Cosa NON cambia
- Logica di dedup prodotti (per `compagnia + nome_prodotto + edizione`).
- RLS personali (solo cliente + privilegi commerciali).
- Pipeline fallback Gemini per PDF cifrati introdotta in precedenza.

### Domanda
Conferma di procedere con **tutti** i campi sopra, oppure preferisci un sottoinsieme (es. solo "Composizione premio per garanzia" + "Anagrafica polizza", lasciando glossario/intermediario a una fase 2)?
