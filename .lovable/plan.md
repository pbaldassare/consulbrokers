
# Messa a Cassa con Anticipi + Causali di Compensazione

## Obiettivo
Quando l'operatore mette a cassa una rata, deve poter quadrare il **Premio Lordo dovuto** con:

```
Premio Lordo = Cash/Bonifico ricevuto + Anticipi cliente usati + Causali di compensazione
```

Esempio: polizza 1.200 €, cliente bonifica 1.150 € → operatore aggiunge riga "Abbuono attivo 50 €" → conti quadrati, scrittura contabile completa.

Niente si salva finché il **delta = 0**.

---

## 1. Tabelle di sistema (UI in `/tabelle-base`)

Sfruttiamo la tabella generica già esistente `causali_contabili` (`tipo_tabella`, `codice`, `descrizione`, `attivo`).

Introduciamo un nuovo `tipo_tabella = 'compensazione_messa_cassa'` con record seed:
- `ABB_ATT` — Abbuono attivo (a favore del cliente, riduce il dovuto)
- `ABB_PAS` — Abbuono passivo (a sfavore del cliente, aumenta il dovuto)
- `SCONTO` — Sconto commerciale
- `ARROT_A` / `ARROT_P` — Arrotondamento attivo/passivo
- `SPESE` — Spese accessorie

In `TabelleBasePage` viene aggiunta la sezione "Causali Compensazione" dove l'admin può creare/modificare/disattivare causali. Niente importo fisso: l'importo lo digita l'operatore al momento della messa a cassa.

## 2. Nuova tabella `titoli_compensazioni`

Traccia ogni riga di compensazione applicata a un titolo:

- `titolo_id` (FK → `titoli`, ON DELETE CASCADE — segue il cascade di annullamento polizza)
- `causale_id` (FK → `causali_contabili`)
- `causale_codice`, `causale_descrizione` (snapshot per storico)
- `importo` (numeric, sempre positivo; il segno è dato dalla causale)
- `segno` (`+` riduce dovuto / `-` aumenta dovuto — derivato da causale)
- `note`
- `creato_da`, timestamps

RLS: stesso pattern di `cliente_anticipi_utilizzi` (staff full, cliente read-only sui propri titoli). GRANT a `authenticated` + `service_role`.

## 3. Unificazione del dialog di Messa a Cassa

Oggi esistono due flussi (memoria progetto conferma il limite):
- `PortafoglioCaricoPage` → usa `MessaCassaDialog` (con anticipi)
- `TitoloDetail` → dialog proprietario (senza anticipi né compensazioni) — è quello dello screenshot

**Refactor**: il dialog di `MessaCassaDialog` diventa l'unico, usato anche da `TitoloDetail`. Così la logica di compensazione vive in un solo posto.

## 4. UI del dialog (estesa)

Sezioni in ordine, sopra al bottone Conferma:

1. **Riepilogo** — Premio lordo dovuto, totale già coperto, **delta residuo** (badge verde se 0, rosso altrimenti).
2. **Cash/Bonifico** — Tipo pagamento + importo (default = delta).
3. **Anticipi disponibili** (solo se tutti i titoli appartengono allo stesso cliente) — checkbox per anticipo con importo modificabile, distribuzione FIFO sui titoli. *Già esistente, riusata.*
4. **Compensazioni** — Bottone "+ Aggiungi causale". Per ogni riga: `SearchableSelect` causale (da `causali_contabili` tipo `compensazione_messa_cassa`, attive) + input importo + note + bottone elimina.
5. **Pulsante "Conferma Incasso" disabilitato finché delta ≠ 0**, con messaggio chiaro ("Mancano 50,00 € per quadrare").

## 5. Persistenza (transazione lato client orchestrata, oppure RPC dedicata)

Al click Conferma:

1. UPDATE `titoli` → `stato='incassato'`, `data_messa_cassa`, `data_incasso`, `data_pagamento`, `importo_incassato` (= cash + anticipi + compensazioni con segno), `tipo_pagamento` (esteso con `'misto'`, `'anticipo_compensazione'`).
2. INSERT righe `cliente_anticipi_utilizzi` (trigger esistente scala i residui).
3. INSERT righe `titoli_compensazioni`.
4. INSERT `movimenti_contabili` (uno per fonte, tutti con `riferimento_tipo='titolo'`, `riferimento_id=titolo_id`, `ufficio_id` dal titolo):
   - una riga incasso premio totale (`categoria='incasso_premio'`)
   - una riga per ogni compensazione (`categoria='compensazione'`, descrizione = codice+descrizione causale, segno corretto)
   - le righe anticipi sono già tracciate via `cliente_anticipi_utilizzi`; aggiungiamo movimento contabile di "utilizzo anticipo" per chiusura partita cliente.
5. Trigger esistente auto-genera quietanza successiva (invariato).
6. `notifica-messa-cassa-agenzia` invariata.

## 6. Annullamento Messa a Cassa

`annullaMessaACassa.ts` viene esteso per:
- DELETE `titoli_compensazioni` del titolo (già protetto dal cascade su annullamento polizza, ma serve esplicito per il caso "solo annulla incasso").
- Il DELETE di `cliente_anticipi_utilizzi` esiste già.
- Il DELETE di `movimenti_contabili` con `riferimento_tipo='titolo'` esiste già — copre anche le righe compensazione.

## 7. Visibilità contabile

- **E/C Cliente** (`/estrazioni/ec-clienti`): le compensazioni appaiono come righe distinte sotto la rata, con segno e causale. Quadratura visibile.
- **Tab "Messa a Cassa"** in `TitoloDetail`: nuovo box "Compensazioni applicate" con elenco causale + importo (read-only dopo l'incasso).
- **Prima nota / Movimenti contabili**: le righe categoria `compensazione` sono filtrabili per causale e periodo.

---

## Sezione tecnica (per chi implementa)

### Migrazione DB
- `INSERT` seed in `causali_contabili` con `tipo_tabella='compensazione_messa_cassa'` (6 codici sopra).
- `CREATE TABLE public.titoli_compensazioni` con FK ON DELETE CASCADE su `titoli`, GRANT a `authenticated`/`service_role`, RLS abilitata, policy staff-full + cliente-read.
- Eventuale colonna `causali_contabili.segno_default` (`+` | `-`) per pilotare il segno UI.

### File toccati
- `supabase/migrations/<new>.sql` — schema + seed.
- `src/components/portafoglio/MessaCassaDialog.tsx` — aggiunta sezione Compensazioni + calcolo delta + lock conferma.
- `src/pages/TitoloDetail.tsx` — sostituisce dialog proprietario con `MessaCassaDialog` condiviso.
- `src/hooks/useCausaliCompensazione.ts` — nuovo hook query.
- `src/hooks/useCompensazioniTitolo.ts` — nuovo hook query/mutation.
- `src/lib/annullaMessaACassa.ts` — DELETE espliciti su `titoli_compensazioni`.
- `src/pages/TabelleBasePage.tsx` — sezione CRUD "Causali Compensazione".
- `src/lib/ec-cliente-pdf.ts` — render righe compensazione.
- `src/components/titolo/CompensazioniBox.tsx` — nuovo, mostrato in tab Messa a Cassa.

### Edge cases
- Bulk Carico con titoli di clienti diversi → sezione anticipi nascosta (come oggi), compensazioni mostrate **per titolo** (un sotto-pannello ciascuno) o disabilitate in bulk e richieste una polizza alla volta. Da confermare in implementazione.
- Riapertura di un'incasso (admin) → ricalcolo coerente.
- Importi sempre arrotondati a 2 decimali, controllo delta con tolleranza `< 0,01`.
