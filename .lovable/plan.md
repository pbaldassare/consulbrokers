
# Piano — Anticipi Cliente

Permettere a un cliente di versare somme **prima** della messa a cassa e di scalarle automaticamente quando si incassano una o più polizze, con gestione di residui parziali e tracciabilità completa.

## 1. Modello dati (Supabase)

### Tabella `cliente_anticipi`
Rappresenta il singolo versamento.
- `cliente_id` → FK `clienti.id` (ON DELETE RESTRICT)
- `data_anticipo` (date, default oggi)
- `conto_bancario_id` → FK `conti_bancari.id` (conto Consulbrokers su cui è arrivato)
- `importo` (numeric 12,2 > 0)
- `importo_residuo` (numeric 12,2) — decrementato dagli utilizzi; calcolato/aggiornato via trigger
- `stato` (text generato: `disponibile` | `parziale` | `esaurito` — derivato da `importo_residuo`)
- `note` (text, opzionale)
- `creato_da` (uuid → profiles)
- `created_at`, `updated_at`

### Tabella `cliente_anticipi_utilizzi`
Lega un anticipo al titolo su cui è stato scalato (N:N effettivo).
- `anticipo_id` → FK `cliente_anticipi.id` (ON DELETE RESTRICT)
- `titolo_id` → FK `titoli.id` (ON DELETE CASCADE — se la polizza viene annullata l'utilizzo sparisce e l'importo torna disponibile)
- `importo_utilizzato` (numeric > 0)
- `data_utilizzo` (date = data messa a cassa)
- `creato_da`, `created_at`

### Trigger DB
- `trg_anticipi_aggiorna_residuo` — su INSERT/UPDATE/DELETE di `cliente_anticipi_utilizzi`: ricalcola `cliente_anticipi.importo_residuo = importo - SUM(utilizzi)`.
- Vincolo: `importo_residuo >= 0` (impedisce sovra-utilizzo).
- Su DELETE utilizzo (es. annullamento polizza → cascade) il residuo torna disponibile automaticamente.

### RLS
- `SELECT/INSERT/UPDATE/DELETE`: admin, cfo, ufficio, backoffice, contabilita sui clienti visibili (riusa pattern esistente con `get_my_cliente_ids()` o equivalente).
- Cliente nel portale: solo `SELECT` sui propri anticipi (read-only, no insert).
- GRANT a `authenticated` + `service_role`.

## 2. UI — Card "Anticipi" nella scheda Cliente

Posizione: `ClienteDetail.tsx`, **a destra della card "Polizze" in alto**, larghezza simile (grid 2 colonne in alto).

Contenuto card:
- Header: "Anticipi Cliente" + totale disponibile in evidenza (€ XXX,XX)
- Tabella zebra compatta con colonne: Data · Conto · Importo · Residuo · Stato (badge) · Azioni
- Click su riga → drawer con elenco utilizzi (link ai titoli)
- Bottone "+ Nuovo Anticipo" → dialog: Data · `ContoBancarioSelect` (tipo `generico`/`incasso_clienti`) · Importo · Note
- Anticipi con residuo = 0 mostrati come collassabili "Storico anticipi esauriti"

Componenti:
- `src/components/clienti/AnticipiCard.tsx` — la card
- `src/components/clienti/NuovoAnticipoDialog.tsx` — form creazione
- `src/components/clienti/AnticipoUtilizziDrawer.tsx` — dettaglio utilizzi

## 3. Integrazione `MessaCassaDialog`

Modifica `src/components/portafoglio/MessaCassaDialog.tsx`:

1. All'apertura, query `cliente_anticipi` del cliente del titolo (per multi-incasso: cliente di ogni titolo; se clienti diversi → mostra anticipi per cliente).
2. Se esistono anticipi con `importo_residuo > 0`: nuova **sezione "💰 Anticipi disponibili"**.
3. Lista checkbox con anticipi: data, conto, residuo. Selezione → input importo da scalare (default = min(residuo, premio_residuo_da_coprire)).
4. Calcolo live:
   ```
   Premio lordo:           € 750,00
   Anticipo utilizzato:  − € XXX
   ─────────────────────
   Da incassare ora:       € YYY
   ```
5. Se `Da incassare ora == 0` → nascondi/disabilita campi Tipo Pagamento + Banca (set automatico `tipo_pagamento = 'anticipo'`).
6. Se `Da incassare > 0` → resta la sezione esistente per scegliere tipo pagamento del residuo (`tipo_pagamento` valori esistenti, `banca` se bonifico).

**Persistenza al conferma**:
- Update `titoli` come oggi, con `tipo_pagamento`:
  - `'anticipo'` se coperto interamente da anticipi
  - tipo scelto se non si usano anticipi
  - `'anticipo_misto'` se misto (nuovo valore consentito nell'enum/check)
- Insert N righe in `cliente_anticipi_utilizzi` (una per ogni anticipo selezionato con il relativo `importo_utilizzato`).
- Trigger DB aggiorna automaticamente `importo_residuo`.
- `importo_incassato` su `titoli` resta = premio lordo (l'incasso è avvenuto, anche se parte come anticipo pregresso).

Multi-titolo (bulk): proporzione FIFO sui titoli in ordine, o sezione anticipi disabilitata se più clienti (v1: supporto solo single-cliente; bulk multi-cliente nasconde sezione anticipi).

## 4. Annullamento incasso / annullamento polizza

- Annullo messa a cassa (`lib/annullaMessaACassa.ts`): DELETE dei record `cliente_anticipi_utilizzi` per quel `titolo_id` → trigger restituisce il residuo all'anticipo.
- Annullamento polizza (cascade già esistente in `policy-cancellation-cascade`): FK ON DELETE CASCADE su `titolo_id` rilascia automaticamente gli importi.

## 5. Storico / E/C cliente

- Riga "Anticipi utilizzati" nei PDF E/C cliente (`lib/ec-cliente-pdf.ts`) accanto ai pagamenti: opzionale v2.
- Log attività (`log_attivita`): azione `anticipo_creato`, `anticipo_utilizzato`, `anticipo_rilasciato` su entità `cliente`/`titolo`.

## 6. Memoria progetto

Aggiungere `mem://accounting/anticipi-cliente.md` con riepilogo regole (tabelle, FIFO, parziali, integrazione MessaCassa, comportamento annullo).

---

## File toccati (stima)

**Nuovi**
- `supabase/migrations/<ts>_anticipi_cliente.sql` (tabelle + trigger + RLS + GRANT)
- `src/components/clienti/AnticipiCard.tsx`
- `src/components/clienti/NuovoAnticipoDialog.tsx`
- `src/components/clienti/AnticipoUtilizziDrawer.tsx`
- `src/hooks/useAnticipiCliente.ts` (query + mutations)
- `.lovable/memory/accounting/anticipi-cliente.md`

**Modificati**
- `src/pages/ClienteDetail.tsx` — layout grid + inserimento `AnticipiCard`
- `src/components/portafoglio/MessaCassaDialog.tsx` — sezione anticipi, payload utilizzi
- `src/lib/annullaMessaACassa.ts` — rilascio utilizzi al rollback

## Note tecniche
- Uso `SearchableSelect` esistente per conti (già `ContoBancarioSelect`).
- Calcoli importi: stessa precisione 2 decimali, arrotondamenti coerenti con `trg_titoli_normalizza_importi`.
- Aggiornare `cliente_anticipi` nelle invalidate query dopo messa a cassa.
- Nuovo valore enum/check `tipo_pagamento`: `'anticipo'`, `'anticipo_misto'` (verifica eventuale constraint esistente).

## Fuori scope (v1)
- Anticipi multi-cliente in bulk incasso.
- Riconciliazione bancaria automatica del versamento anticipo (l'utente seleziona manualmente il conto).
- Rimborso anticipo non utilizzato (gestito a mano fuori sistema, v2).
