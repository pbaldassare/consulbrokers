
# Fase 2 — UI sul nuovo modello Polizze ↔ Quietanze

Obiettivo: le viste operative leggono/scrivono direttamente su `polizze` e `quietanze`. La tabella `titoli` resta come legacy in sola lettura (sync via trigger già attivo da Fase 1) finché non rimuoviamo le ultime dipendenze in Fase 3.

## Principio guida

- **Anagrafica/contratto** (numero polizza, cliente, compagnia, ramo, garanzie, RCA, durata, frazionamento, stato del contratto) → `polizze`.
- **Movimenti economici/cassa** (premio rata, messa a cassa, incasso, provvigioni, rimesse, E/C) → `quietanze`.

Tutto ciò che oggi guarda `titoli` viene mappato esplicitamente.

## Modifiche per area

### 1. Dettaglio polizza (`/titoli/:id` → `/polizze/:id`)

- Nuova route `/polizze/:id` con `PolizzaDetail.tsx` che legge da `polizze` + lista `quietanze` collegate.
- Tab principali:
  - **Contratto** (anagrafica polizza, sezione PolizzaSection già esistente, lock UI invariato).
  - **Quietanze** (tabella rate con `numero_rata`, `data_decorrenza/scadenza`, `premio_lordo`, `stato`, badge Messa a Cassa / Incassata / Stornata, azione "Apri quietanza").
  - **Appendici**, **Sinistri**, **Log Attività**: invariati ma filtrati su `polizza_id`.
- Vecchia route `/titoli/:id` resta attiva: se il titolo ha `polizza_id`, redirect automatico al nuovo dettaglio sulla quietanza giusta (deep link preservato).

### 2. Dettaglio quietanza (`/quietanze/:id`)

- Nuovo `QuietanzaDetail.tsx`: vista sola-rata con sezioni Premio, Provvigioni, Messa a Cassa, Incasso, Rimessa.
- Riusa i componenti già pronti (`MessaCassaDialog`, `IncassoDialog`, pannello rimesse) ma puntati su `quietanza_id`.
- Banner con link al contratto madre (`polizza_id`).

### 3. Portafoglio (Attive / Carico del Mese / Storico)

- Le tre viste lavorano su **quietanze** (è dove vive `data_messa_cassa`, `stato`, `data_incasso`).
- Join `quietanze → polizze` per colonne anagrafica (numero polizza, cliente, ramo, sottoramo, compagnia).
- Filtro **Tipo** (Polizza/Quietanza) tramite `numero_rata = 1` vs `> 1` (sostituisce il vecchio criterio su `sostituisce_polizza`).
- Filtri esistenti (compagnia, ramo+sottoramo coordinati, sede, AE, produttore, stato) restano: si applicano sulla join.
- Paginazione server-side 25/350ms invariata.

### 4. Messa a Cassa & Incassi

- `MessaCassaDialog`, batch "Messa a cassa multipla", dialog incasso, riapertura: agiscono su `quietanze`.
- Trigger DB già esistenti (`tg_quietanza_sync_to_titoli`) replicano sul legacy → contabilità/rimesse pre-Fase-2 continuano.
- Generazione rata successiva: invariata (trigger `trg_quietanza_messa_cassa` di Fase 1).

### 5. Rimesse compagnia + Note di restituzione

- Selezione titoli da includere → ora seleziona **quietanze** `incassato` con `data_messa_cassa` nel periodo.
- `rimessa_dettaglio` e `note_restituzione_dettaglio`: aggiunta colonna `quietanza_id` (FK nullable) accanto al `titolo_id`. Doppia scrittura finché esistono righe legacy.
- PDF rimessa e Rimessa mittente Napoli: invariati nel layout, solo la sorgente cambia.

### 6. Estratto Conto Clienti & Compagnie

- E/C Cliente: righe da `quietanze` con `data_messa_cassa not null`, join `polizze` per anagrafica.
- E/C Compagnia / Produttore: idem, raggruppando per `polizza_id → compagnia_id` e `polizza_id → ae_anagrafica_id`.
- Mantenuti i totali Lordo/Netto/Provvigioni dal trigger di normalizzazione già in vigore.

### 7. Provvigioni (matrice, generate, pagamenti)

- `provvigioni_generate`: aggiunta colonna `quietanza_id` (FK nullable). Generazione futura scrive `quietanza_id`; il join legacy via `titolo_id` resta per le righe storiche.
- Distinte pagamento e cascade su annullamento polizza: estesi alla nuova colonna.

### 8. Sinistri, Appendici, Sostituzioni, Storni, Trattative

- Aggiunta `polizza_id` (FK nullable) dove ancora mancante (`sinistri`, `titoli_sostituzioni`, `titoli_storni`, `trattative` quando convertite). Backfill batch dal `titoli.polizza_id`.
- UI: i selettori "scegli polizza" leggono `polizze` invece di `titoli` madre.

### 9. Cleanup legacy (preparazione Fase 3, non eseguito ora)

- Marcare `titoli` come read-only in TS (`Database['public']['Tables']['titoli']`): solo `select`. Non rimuoviamo ancora, ma niente nuove insert dalla UI tranne i trigger di sync.
- Documentare in memoria che `ImmissionePolizzaPage`, `MessaCassaDialog`, rimesse, E/C, provvigioni **non scrivono più direttamente su `titoli`**.

## Migrazioni DB (un'unica migration di Fase 2)

1. `ALTER TABLE rimessa_dettaglio ADD COLUMN quietanza_id uuid REFERENCES quietanze(id)`.
2. `ALTER TABLE note_restituzione_dettaglio ADD COLUMN quietanza_id uuid REFERENCES quietanze(id)`.
3. `ALTER TABLE provvigioni_generate ADD COLUMN quietanza_id uuid REFERENCES quietanze(id)`.
4. `ALTER TABLE sinistri ADD COLUMN polizza_id uuid REFERENCES polizze(id)` (se mancante).
5. `ALTER TABLE titoli_sostituzioni / titoli_storni ADD COLUMN polizza_id uuid REFERENCES polizze(id)`.
6. Backfill: `UPDATE ... SET quietanza_id = q.id FROM quietanze q WHERE q.titolo_id = <row>.titolo_id`. Idem `polizza_id` via `titoli.polizza_id`.
7. Indici su tutte le nuove FK.
8. Aggiornamento trigger di sync per propagare le nuove relazioni.
9. RPC `fn_polizza_annullamento_cascade(polizza_id)` aggiornata per cancellare provvigioni/rimesse/quietanze future via `quietanza_id` o `polizza_id`.
10. View materializzata `v_portafoglio_quietanze` (cliente+polizza+quietanza+ramo+sede+AE) per query UI rapide, ricostruita dai trigger esistenti.

## Validazione

- Quadratura totale premi, provvigioni e incassati prima/dopo: identici (script che confronta SUM su `titoli` vs `quietanze`).
- Spot check: aprire 5 polizze (annuale incassata, semestrale 2 rate, mensile 12 rate, RCA con regolazione, polizza sospesa) e confrontare UI nuova vs legacy.
- Test Playwright su: emissione polizza → comparsa quietanze, messa a cassa → stato → generazione rata successiva, annullamento polizza → cascade.

## Out of scope Fase 2

- Rimozione fisica della tabella `titoli` (Fase 3).
- Riscrittura completa di edge functions provvigioni/AI (Fase 3, una alla volta).
- PWA cache / mobile dedicato.

## Domande prima di partire

1. **Routing**: introduciamo subito `/polizze/:id` e `/quietanze/:id` (con redirect dai vecchi `/titoli/:id`) o manteniamo l'URL `/titoli/:id` come alias permanente per non rompere bookmark/email?
2. **Doppia scrittura**: in Fase 2 vogliamo che le nuove operazioni (messa a cassa, rimessa, provvigione) scrivano **solo** su `quietanze` (e i trigger replicano su `titoli`), oppure doppia scrittura esplicita lato UI per maggiore sicurezza durante il rollout?
3. **Ordine di rollout**: meglio cominciare da **Dettaglio polizza/quietanza + Portafoglio** (visibilità immediata) o da **Messa a cassa + Rimesse + E/C** (catena contabile completa) prima di toccare le viste di portafoglio?
