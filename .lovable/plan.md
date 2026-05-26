## Obiettivo

Oggi la **Sospensione** genera solo una riga in `movimenti_polizza` (tipo `SO`). Non esiste un record in `titoli` corrispondente, quindi l'evento non compare nell'estratto conto cliente / agenzia / produttore e non è gestibile come gli altri titoli (messa a cassa, distinte, ecc.).

Vogliamo che la sospensione sia **sempre** registrata come un vero **titolo** (anche se l'importo è 0 €), speculare a come la Riattivazione genera già il titolo "Oneri di Riattivazione".

## 1. SospensionePolizzaDialog — nuovo campo "Oneri di sospensione"

Aggiungo nel dialog (colonna sinistra, sotto "Motivo"):

- **Oneri di sospensione (€)** — input numerico, default `0`, accetta anche `0` come valore valido.
- Etichetta nota: *"Verrà creato un titolo di sospensione anche se l'importo è 0."*

## 2. Mutation: insert titolo SO sempre

Dopo i passaggi attuali (cancellazione quietanze future, update stato, nuovo numero, upload documento), **prima** della riga `movimenti_polizza`, inserisco un nuovo record in `titoli`:

- `numero_titolo` = stesso della rata madre (post-eventuale rinumerazione)
- `riga` = max(`riga`) esistente per quel `numero_titolo` + 1
- `note` = `"Sospensione polizza"` (+ motivo se presente)
- `premio_lordo` = oneri inseriti (0 di default)
- `premio_netto`, `accessori`, `tasse` = 0 se oneri = 0, altrimenti `premio_lordo = oneri` con `premio_netto = oneri` e tasse 0 (sospensioni non hanno imposte)
- `sostituisce_polizza` = `numero_titolo` corrente, `sostituisce_riga` = riga madre (per legarlo logicamente)
- `data_decorrenza` / `garanzia_da` / `garanzia_a` = `data_sospensione` (single-day)
- `data_scadenza` = `data_sospensione`
- `frazionamento` = `"Unica"`
- `stato` = `attivo` (così entra in **Carico del Mese** ed è disponibile per messa a cassa)
- `data_messa_cassa` = NULL
- Split commerciale / provvigioni: copia 1:1 dai campi della rata madre (`anagrafica_commerciale_id`, `account_executive_id`, `ufficio_id`, `cliente_id`, `compagnia_id`, `ramo_id`, `gruppo_ramo_id`, ecc.), così l'E/C aggancia gli stessi soggetti.
- Provvigioni: 0 (non maturano provvigioni sulla sospensione) — `provvigione_*` lasciati a 0.

Lego l'id del nuovo titolo SO alla riga `movimenti_polizza` esistente (campo `titolo_id` già presente), in modo che dalla card movimenti si possa atterrare sul nuovo titolo.

## 3. Log & feedback

- `logAttivita` aggiunge `titolo_sospensione_id` e `oneri_sospensione` in `dettagli_json`.
- Toast: aggiunge "titolo di sospensione creato (€ X,XX)".
- Invalidate query estese a `portafoglio-carico`, `titoli`, `ec-*` (estratti conto già coperti dalle invalidate `portafoglio`).

## 4. Conseguenze su UI esistente

- **TitoloDetail della polizza madre**: la card "Numeri polizza storici" è invariata. Il titolo di sospensione apparirà come riga separata (stesso `numero_titolo`) nelle viste polizze e nella tab "Quietanze" (con badge "Sospensione" derivato da `note`).
- **Polizze / Carico del Mese**: il titolo SO compare normalmente e può essere messo a cassa con il flusso standard, anche se a 0 €.
- **E/C cliente / agenzia / produttore**: compare riga con importo 0 € (o oneri) → richiesta esplicita dell'utente.

## 5. File toccati

- `src/components/polizze/SospensionePolizzaDialog.tsx` — nuovo state `oneriSospensione`, input UI, mutation estesa con insert titolo SO.
- `.lovable/memory/insurance/policy-suspension-rules.md` — aggiungo sezione "Titolo di sospensione" (sempre creato, anche a 0 €, speculare a Riattivazione).
- `public/version.json` — bump.

## Note / decisioni

- **Nessuna migrazione DB**: si usano campi `titoli` già esistenti. Nessuna nuova colonna.
- **Nessun cambiamento al flusso quietanze future**: continuano a essere cancellate come oggi.
- **`PolizzaEditorInline.commit("sospensione")` → snapshot**: resta sulla polizza madre, invariato.
- Se la rata madre è già `incassato`/`stornato` (UI bloccata) il dialog non si apre, quindi nessun edge case extra.

Confermi così, oppure preferisci che il titolo SO sia creato solo quando oneri > 0?
