## Separazione Polizza ↔ Quietanza — Fase 1

Obiettivo: introdurre il modello "1 Polizza-Contratto + N Quietanze" senza toccare contabilità/portafoglio/rimesse. La tabella `titoli` resta letta da tutto il resto dell'app finché non passeremo alle fasi successive.

---

### 1. Modello dati nuovo

Due nuove tabelle in `public`. La tabella `titoli` **non viene droppata** in Fase 1: viene marcata legacy e continua a essere popolata per retro-compatibilità (vedi §4).

**`polizze`** — il contratto assicurativo. Dura quanto la polizza, non si mette mai a cassa.

Campi (gruppi):
- Identificazione: `id (uuid pk)`, `numero_polizza (text)`, `numero_polizza_precedente`, `cig_rif`, `appendice_corrente`.
- Cliente: `cliente_anagrafica_id (fk clienti)`.
- Compagnia/rapporto: `compagnia_id`, `compagnia_rapporto_id`, `ramo_id`, `gruppo_ramo_id`, `prodotto_nome`, `tipo_mandatario`, `risk_type`.
- Commerciale: `ufficio_id`, `account_executive_anagrafica_id`, `produttore_anagrafica_id`, `commerciale_id`, `percentuale_commerciale`, `percentuale_riparto`, `anagrafica_commerciale_id`.
- Contratto: `durata_da (date)`, `durata_a (date)`, `anni_durata`, `frazionamento (text — Mensile..Poliennale)`, `tacito_rinnovo (bool)`, `disdetta_mesi`, `tipo_scadenza`, `giorni_presentazione`.
- Regolazione/indicizzazione: `regolazione (bool)`, `tipo_lettera_regolazione`, `indicizzata`, `libro_matricola`.
- Premio "di tariffa" (NON contabile — solo riferimento per calcolare le rate): `premio_annuo_lordo`, `premio_annuo_netto`, `tasse_annue`, `addizionali_annue`, `provvigioni_annue_firma`, `provvigioni_annue_quietanza`, `no_calcolo_tasse`, `valuta`, `cambio`.
- Veicolo/RCA (se ramo RCA): `targa_telaio`, FK a `veicoli_polizza`.
- Flag operativi: `pag_diretto_compagnia`, `emissione_fee`, `formato_elettronico`, `vincolo`.
- Stato polizza: `stato` enum `attiva | sospesa | annullata | scaduta | sostituita`, `data_sospensione`, `data_riattivazione`, `data_annullamento`, `motivo_annullamento`, `sostituisce_polizza_id (fk self)`, `sostituita_da_polizza_id (fk self)`.
- Descrittivi: `descrizione_polizza`, `note`, `tipo_portafoglio`.
- Audit: `created_at`, `updated_at`, `created_by`, `search_vector`.
- Link legacy (per fase di transizione): `titolo_madre_id (fk titoli)` — riempito dalla migrazione retroattiva.

**`quietanze`** — la singola rata pagabile. Tutto ciò che oggi è "messa a cassa / incasso / rimessa / EC cliente / provvigioni maturate" appartiene logicamente qui.

Campi:
- FK: `id`, `polizza_id (fk polizze on delete restrict)`, `numero_rata (int)`, `numero_rate_totali (int)`.
- Periodo: `garanzia_da`, `garanzia_a`, `data_competenza`, `data_scadenza`, `mora_giorni`, `limite_mora`.
- Importi rata (questi sono i valori contabili, gli unici che contano per cassa): `premio_lordo`, `premio_netto`, `tasse`, `addizionali`, `ssn`, `provvigioni_firma`, `provvigioni_quietanza`.
- Stato/cassa: `stato` enum `da_incassare | incassato | sospesa | annullata | stornata`, `data_messa_cassa`, `data_pagamento`, `data_incasso`, `importo_incassato`, `tipo_incasso`, `conto_incasso`.
- Eredità per audit: `appendice` (snapshot al momento della generazione), `numero_polizza_snapshot`.
- Link legacy: `titolo_id (fk titoli)` — la rata corrispondente nel vecchio modello.
- Audit: `created_at`, `updated_at`, `search_vector`.

Indici: `(polizza_id, numero_rata)` unique; `(polizza_id)`; `(stato, data_scadenza)`; `(data_messa_cassa)`; `(garanzia_da, garanzia_a)`; FTS su `search_vector`.

GRANT + RLS: stessa logica di `titoli` (RLS via `has_role` e visibilità per sede/produttore). Policy speculari, niente accesso anon.

**Tabelle collegate** (Fase 1 = solo aggiungere colonne FK opzionali, niente migrazione dati):
- `premi_garanzia_polizza`: aggiungere `polizza_id` e `quietanza_id` (nullable). Le righe del nuovo flusso useranno queste; le vecchie continuano a usare `titolo_id`.
- `appendici_polizza`: aggiungere `polizza_id` (nullable). Resta legato a `titoli` per i dati storici.
- `movimenti_polizza`, `titoli_storni`, `titoli_sostituzioni`, `titoli_split_commerciali`: **non toccate in Fase 1**, restano sul vecchio modello.

---

### 2. Trigger e RPC nuove

Tutto SECURITY DEFINER, `SET search_path = public`.

1. **`fn_polizza_genera_quietanze(polizza_id uuid)`** — RPC chiamata dopo l'INSERT della polizza. Calcola N rate in base a `frazionamento` + `durata_da`/`durata_a`, crea le righe `quietanze` con `stato='da_incassare'`, importi proporzionali al frazionamento (riusa `src/lib/frazionamento.ts` lato server replicandone la logica in SQL).
2. **`trg_polizza_after_insert`** → chiama `fn_polizza_genera_quietanze` automaticamente.
3. **`trg_polizza_after_update_premio`** → se cambiano gli importi annui della polizza, aggiorna SOLO le quietanze future (`stato='da_incassare' AND data_messa_cassa IS NULL`). Mai le incassate.
4. **`trg_polizza_annullamento`** → su passaggio a `stato='annullata'`, cascade-delete delle quietanze non incassate (specchio di `policy-cancellation-cascade`).
5. **`trg_quietanza_messa_cassa`** → riproduce la logica di `genera_quietanza_su_messa_cassa` ma tra quietanze (genera la successiva al passaggio a `incassato` SOLO se mancante e se la polizza non ha già tutte le rate). Per polizze annuali con 1 sola quietanza la rata successiva è generata solo al rinnovo (gestione fase 2).
6. **Trigger di sync legacy**: `trg_polizza_sync_to_titoli` e `trg_quietanza_sync_to_titoli` — su INSERT/UPDATE replicano i campi rilevanti sulla riga `titoli` collegata (`titolo_madre_id` / `titolo_id`). Serve a tenere viva contabilità/portafoglio/rimesse senza dover toccare ~50 file in Fase 1. Triggerati con `SET LOCAL app.sync_from_polizze = 'on'` per evitare loop.

---

### 3. Stati e regole (riepilogo invariante)

| Entità | Stati ammessi | Chi li cambia |
|---|---|---|
| `polizze.stato` | `attiva, sospesa, annullata, scaduta, sostituita` | UI polizza (sospensione/annullamento), cron `scaduta` su `durata_a < today` |
| `quietanze.stato` | `da_incassare, incassato, sospesa, annullata, stornata` | UI messa a cassa, annullaMessaACassa, storni |

- Polizza `sospesa` ⇒ tutte le quietanze future restano `da_incassare` ma non possono essere messe a cassa (guard nel trigger).
- Polizza `annullata` ⇒ cascade su quietanze non incassate; quelle incassate restano per storico.
- Una quietanza `incassato` è **immutabile** sui campi contabili (riusa `trg_prevent_double_messa_cassa`).

---

### 4. Migrazione retroattiva (script SQL nella stessa migrazione)

Per ogni catena `titoli` esistente (raggruppata da `numero_titolo`):

1. Identifica la **madre** (`sostituisce_polizza IS NULL`) e le **rate** (`sostituisce_polizza IS NOT NULL`), ordinate per `garanzia_da`.
2. INSERT in `polizze` una riga derivata dalla madre: copia anagrafica/contratto/premio annuo (sommando importi se la polizza è poliennale e l'importo della madre è una rata). Set `titolo_madre_id = madre.id`.
3. Per ogni titolo della catena (madre + rate) INSERT in `quietanze` con `polizza_id = nuova polizza`, `numero_rata` progressivo, importi e stato copiati 1:1 dal titolo (`incassato` se `data_messa_cassa IS NOT NULL`, altrimenti `da_incassare`). Set `quietanze.titolo_id = titolo.id`.
4. Riempi `titoli.polizza_id` (nuova colonna nullable su `titoli`) per chiusura del cerchio: ogni titolo punta alla polizza di appartenenza.
5. **Quadratura obbligatoria**: la migrazione finisce con un blocco di verifica che fa `RAISE EXCEPTION` se per qualunque cliente cambiano i totali di `SUM(premio_lordo)`, `SUM(provvigioni_firma+provvigioni_quietanza)`, `COUNT(stato='incassato')` rispetto a prima. Se la verifica fallisce, ROLLBACK automatico.

Polizze duplicate intoccabili (`204366651`, `6131402092`, `RCM00010074404`): nessuna deduplica — diventano 3 polizze distinte come oggi sono 3 catene distinte.

---

### 5. UI — solo `ImmissionePolizzaPage` in Fase 1

Riscrittura dell'`onSubmit` (oggi scrive su `titoli` + eventuali `premi_garanzia_polizza`):

1. INSERT in `polizze` con tutti i dati anagrafici/contratto/premio annuo.
2. INSERT in `premi_garanzia_polizza` legati alla nuova polizza (`polizza_id` valorizzato).
3. Il trigger `trg_polizza_after_insert` genera automaticamente le N quietanze.
4. Il trigger di sync legacy replica polizza+prima quietanza su `titoli` (così TitoloDetail, portafoglio, contabilità continuano a funzionare invariati).
5. Redirect post-salvataggio: per ora resta su `/titoli/:id` (il titolo legacy della prima quietanza), così TUTTO il resto dell'app continua a funzionare. Il passaggio al nuovo `/polizze/:id` arriverà in Fase 2.

Le sezioni del form (`PolizzaSection`, `PremiGaranziaCardShell`, RCA, ecc.) non cambiano UI: cambia solo il target del salvataggio.

Banner informativo nel form: "Stai emettendo una polizza con il nuovo modello: verranno generate N quietanze in base al frazionamento selezionato".

---

### 6. Fuori scope Fase 1 (esplicito)

Non si toccano in questa fase:
- `TitoloDetail`, portafoglio (Carico/Attive/Storico), `MessaCassaDialog`, rimesse, EC cliente/agenzia/produttore, provvigioni maturate, pagamenti provvigioni, sinistri, appendici, storni, sostituzioni, edge functions (notifiche email, AI commission import, ec-pdf, ecc.), PWA cache.
- Niente nuove route `/polizze/:id` o `/quietanze/:id` ancora.
- Niente rimozione di `titoli`.

Queste sono Fase 2 (UI dettaglio Polizza + viste portafoglio puntate su `quietanze`), Fase 3 (contabilità switch), Fase 4 (dismissione `titoli`).

---

### 7. Deliverable Fase 1

1. **Migration SQL unica** con: enum stati, CREATE `polizze`, CREATE `quietanze`, GRANT, RLS, indici, trigger di generazione/sync/cascade, RPC `fn_polizza_genera_quietanze`, script di migrazione retroattiva con quadratura obbligatoria.
2. **`src/pages/ImmissionePolizzaPage.tsx`** — `onSubmit` riscritto per scrivere su `polizze` + `premi_garanzia_polizza(polizza_id)`. Banner informativo.
3. **`src/lib/frazionamento.ts`** — eventuale helper `splitPremioInRate(annuo, frazionamento, durataMesi)` se la generazione lato DB necessita di parità coi calcoli frontend (riferimento per i test).
4. **Test SQL inline nella migrazione**: blocco `DO $$ BEGIN ... ASSERT ... END $$` che dopo la migrazione retroattiva verifica conteggi e totali per cliente.
5. **Memory updates** post-implementazione: nuova memory `insurance/polizza-quietanza-split-model` con il modello a due tabelle, stati, sync legacy attivo finché Fase 4 non chiude il ciclo.

### 8. Rischio principale

La migrazione retroattiva è il punto critico: se la quadratura fallisce su anche un solo cliente, ROLLBACK e si itera lo script. Prima di lanciarla farò una `read_query` di profilazione sui pattern di catene anomale (titoli orfani, rate senza madre, madri con `data_messa_cassa` ma `sostituisce_polizza` valorizzato, ecc.) e tratterò ciascun pattern esplicitamente nello script.
