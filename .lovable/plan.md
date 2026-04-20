

## Richiesta

Quando rinnovo una polizza:
- Il nuovo titolo viene creato (ok)
- **NON** deve apparire nel "Carico del Mese" finché la polizza **originale** (quella da cui deriva) non è stata messa a cassa
- Solo dopo la messa a cassa dell'originale, il rinnovo deve diventare "attivo" e comparire nel carico del nuovo periodo

## Stato attuale

In `RinnovoTitoloDialog.tsx`:
```ts
stato: "attivo",           // ← il rinnovo nasce subito attivo
sostituisce_polizza: t.numero_titolo,
sostituisce_riga: t.riga,
```

In `PortafoglioCaricoPage.tsx` la query del carico filtra:
```ts
.in("stato", ["attivo", "incassato"])
```
→ quindi il rinnovo appena creato compare subito nel carico del nuovo mese, anche se l'originale non è ancora stato messo a cassa. Errato.

## Soluzione

### 1. Nuovo stato "in_attesa_rinnovo" sul titolo rinnovato

Quando si crea il rinnovo da `RinnovoTitoloDialog`:
- `stato = 'in_attesa_rinnovo'` (invece di `'attivo'`)

Vincolo DB attuale (`policy-states` memory) ammette solo: `attivo`, `sospeso`, `scaduto`, `incassato`. Va esteso il check constraint per includere `in_attesa_rinnovo`.

### 2. Attivazione automatica al momento della messa a cassa dell'originale

Trigger DB su `titoli` (AFTER UPDATE): quando un titolo passa a `stato = 'incassato'` (con `data_messa_cassa` valorizzata), cerca eventuali titoli figli (`sostituisce_polizza = NEW.numero_titolo` AND `sostituisce_riga = NEW.riga` AND `stato = 'in_attesa_rinnovo'`) e li promuove a `stato = 'attivo'`.

Così:
- Rinnovo eseguito oggi → titolo nuovo in `in_attesa_rinnovo` → NON nel carico
- Domani metto a cassa l'originale → trigger promuove il rinnovo a `attivo` → compare nel carico del mese di scadenza

### 3. UI: badge dedicato

Nel dettaglio titolo (`TitoloDetail.tsx`) e nelle liste portafoglio (Attive, Storico, eventuale "in pipeline"):
- Badge "In attesa rinnovo" colore arancione/ambra
- Tooltip: "Diventerà attivo quando la polizza precedente sarà messa a cassa"

Nel `Carico del Mese`: filtro invariato (`stato in ['attivo','incassato']`) → i rinnovi in attesa NON vi compaiono. Corretto.

### 4. Visibilità dei rinnovi pending

Aggiungere una piccola sezione/contatore in cima al `Carico del Mese`: 
- "N rinnovi in attesa di messa a cassa della polizza precedente"
- Click → apre dialog/lista con i rinnovi pending del mese, con link a ciascuno

Così l'utente vede che i rinnovi sono stati preparati ma non ancora "presi in carico".

### 5. Edge case: cosa succede se l'originale viene stornata o non messa a cassa?

- Se l'utente apre manualmente il rinnovo `in_attesa_rinnovo` e clicca "Forza attivazione" (pulsante visibile solo in dettaglio per admin/responsabile) → diventa `attivo`
- Se l'originale viene stornata → il rinnovo resta in attesa, mostriamo warning nel dettaglio del rinnovo con link all'originale

## File toccati

**DB** (1 nuova migrazione):
- Allarga il check constraint `titoli_stato_check` per includere `in_attesa_rinnovo`
- Trigger `trg_attiva_rinnovo_su_messa_cassa` AFTER UPDATE su `titoli`
- (opzionale ma utile) Indice su `(sostituisce_polizza, sostituisce_riga, stato)` per il trigger

**Frontend**:
- `src/components/polizze/RinnovoTitoloDialog.tsx` — cambio `stato: 'attivo'` → `'in_attesa_rinnovo'`; toast aggiornato ("Rinnovo creato — diventerà attivo alla messa a cassa della polizza precedente"); naviga al dettaglio del nuovo titolo come ora
- `src/pages/TitoloDetail.tsx` — gestione badge nuovo stato + pulsante "Forza attivazione" (solo admin) + warning se originale stornata
- `src/pages/PortafoglioCaricoPage.tsx` — sezione "Rinnovi in attesa" in cima (contatore + dialog/lista)
- `src/pages/PortafoglioAttivePage.tsx` / `PortafoglioStoricoPage.tsx` — verifica filtri stato (probabilmente vanno esclusi o messi in sezione separata)
- Eventuali altri componenti che mappano `stato` → label/colore (cerco con grep e aggiorno)

## Cosa NON faccio

- Niente cambio della logica di immissione manuale (resta `'attivo'` di default)
- Niente cambio del flusso Appendici / Storno
- Non modifico polizze esistenti già rinnovate (resto `attivo`); la regola si applica solo ai nuovi rinnovi creati post-deploy

## Verifica post-fix

1. Apro polizza A (scadenza 24/04/2026, ancora in carico del mese, NON messa a cassa)
2. Clicco "Rinnova" → creo polizza B (scadenza 24/04/2027), stato `in_attesa_rinnovo`
3. Vado in `/portafoglio/carico` filtrando aprile 2027 → polizza B **non** compare
4. Vedo in cima al carico di aprile 2026: "1 rinnovo in attesa"
5. Metto a cassa polizza A → trigger promuove B a `attivo`
6. Vado in `/portafoglio/carico` filtrando aprile 2027 → polizza B compare ora
7. Provo anche il pulsante "Forza attivazione" su un altro rinnovo come admin → funziona

