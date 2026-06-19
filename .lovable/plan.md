## Cosa ho capito (verifica sul DB)

Modello attuale (post-Fase 1, 18/06/2026):

- **`polizze`** = contratto. Non ha nessuna colonna `data_messa_cassa` / `data_incasso` (verificato su `information_schema.columns`). Stati: `attiva | sospesa | annullata | scaduta | sostituita`. ✅ Già coerente.
- **`quietanze`** = rata. È l'unica entità che si incassa. Stati: `da_incassare | incassato | sospesa | annullata | stornata`. ✅ Già coerente.
- **`titoli`** (legacy, ancora canonico per portafoglio/contabilità) = un record per rata. La madre `riga=0` rappresenta sia "la polizza" sia "la prima rata". È qui che restano `stato='incassato'` e `data_messa_cassa` sulla riga 0 quando la prima rata è incassata.

Esempio polizza 121222 (quella nello screenshot):
- `polizze.id=5bf1f7a6…` (nessun campo messa-a-cassa).
- `quietanze`: rata 1 `incassato`, rata 2 `da_incassare`. ✅
- `titoli` riga 0: `stato=incassato, data_messa_cassa=2026-06-10` (perché è la prima rata).
- `titoli` riga 1: `stato=attivo, data_messa_cassa=null`. ✅

Quindi **il dato di backend è già corretto**: la polizza non è messa a cassa, lo è la prima quietanza. Quello che nello screenshot fa sembrare il contrario è solo l'**UI di `TitoloDetail`**, che mostra la riga 0 di `titoli` etichettandola "Polizza 121222 — Polizza originale" col badge `incassato` e il banner "Polizza messa a cassa — modifiche dirette bloccate". È una svista di copy/framing, non un errore di modello.

## Ambito del fix

Solo presentazionale su `src/pages/TitoloDetail.tsx`. Nessuna modifica a schema, trigger, RPC, contabilità o flussi.

### 1) Copy: "Polizza" → "Quietanza" dove descriviamo l'incasso

Sulla riga 0/madre il record `titoli` rappresenta la **Rata 1**. Riformulo i due messaggi che oggi parlano di "Polizza":

- Banner ambra in cima alla pagina (oggi: *"Polizza messa a cassa — modifiche dirette bloccate. Per riaprirla usa Annulla Incasso / Annulla Messa a Cassa."*) → *"Quietanza (Rata N) messa a cassa — modifiche dirette bloccate…"*.
- Dialog di conferma "Polizza già messa a cassa il …" + corpo *"Questa polizza è stata messa a cassa…"* → sostituiti con "Quietanza" e l'indice rata.
- Tooltip e label dentro la sezione Operazioni che dicono "polizza" → "quietanza" quando l'azione è incasso/storno/annullamento incasso.

Le sezioni che parlano davvero del **contratto** (Sospensione/Riattivazione/Sostituzione/Estinzione/Appendici) restano "Polizza".

### 2) Header pagina

Header attuale: `Polizza 121222 — Polizza originale  [incassato]`. Modifico:

- Sostituisco il badge stato in alto a destra: invece di mostrare `titoli.stato` (che è lo stato della rata corrente), mostro **due** chip distinti:
  - **Stato Polizza** dal nuovo modello: leggo `polizze.stato` tramite `titoli.polizza_id`. Esempio: `attiva`.
  - **Stato Quietanza** dalla rata corrente (`titoli.stato`): `incassato`.
- Lo stato `incassato` viene quindi visivamente ricondotto alla rata, non al contratto.

Se `titoli.polizza_id` è null (record legacy non ancora riallineati) si mostra solo lo stato titolo come oggi (fallback retro-compatibile).

### 3) "Inibizione" lato nuovo flusso

Verificato: nessun code-path scrive `data_messa_cassa` su `polizze` (la colonna non esiste). Nessuna nuova inibizione DB necessaria.

Sul lato `titoli` la scrittura di `data_messa_cassa` è corretta: avviene sulla rata che si sta incassando (`UPDATE titoli … WHERE id = <rata>`). Resta intatta.

## Cosa NON cambia

- Schema DB (polizze/quietanze/titoli) e trigger.
- Logica di messa a cassa, anti-doppio-incasso, generazione quietanze, rimesse, EC, provvigioni.
- Annullamento, sospensione, sostituzione, estinzione.
- Backfill o normalizzazione di dati storici: non serve (i dati sono già coerenti col nuovo modello).

## File toccati

- `src/pages/TitoloDetail.tsx` — solo testi del banner/dialog/tooltip + header con doppio chip stato che legge `polizze.stato` via `titoli.polizza_id`.
