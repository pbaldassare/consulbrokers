## Obiettivo

Trasformare i 4 dialog evento polizza (**Sospensione, Riattivazione, Sostituzione, Estinzione**) da popup minimali a editor unificati: l'utente vede e modifica in contemporanea tutti i dati rilevanti (date, garanzie, premi, parametri oggetto) + i campi specifici dell'evento, e con **una sola conferma** il sistema salva uno snapshot della polizza pre-evento e applica le modifiche live.

---

## Esempio concreto (per dimostrare la comprensione)

Polizza `errer` su `/titoli/2d40a2f9-…`, premio firma 1.543,16 €, 3 garanzie (RCA / ARD / Furto), frazionamento Semestrale.

L'utente clicca **Sospendi**. Si apre il dialog "Sospensione Polizza" largo **4xl**, con due colonne:

```text
┌─────────────────────────── Sospensione Polizza errer ───────────────────────────┐
│ COLONNA SX — Evento                COLONNA DX — Snapshot polizza modificabile  │
│ ┌──────────────────────────────┐   ┌──────────────────────────────────────────┐ │
│ │ Data Sospensione *           │   │ Effetto:  01/01/2026                     │ │
│ │ [26/05/2026]                 │   │ Scadenza: [31/12/2026]  ← editabile      │ │
│ │ Limite Riattivazione         │   │ Frazionamento: Semestrale                │ │
│ │ [25/08/2026]                 │   │                                          │ │
│ │ Motivo                       │   │ Garanzie (editabili riga per riga):      │ │
│ │ [textarea...]                │   │ ┌────────┬────────┬────────┬──────────┐  │ │
│ │ Allegato: [seleziona file]   │   │ │ RCA    │ 800,00 │  80,00 │ 1.000,00 │  │ │
│ └──────────────────────────────┘   │ │ ARD    │ 300,00 │  30,00 │   400,00 │  │ │
│                                    │ │ Furto  │ 100,00 │  10,00 │   143,16 │  │ │
│                                    │ └────────┴────────┴────────┴──────────┘  │ │
│                                    │ [+ aggiungi]  [elimina riga]             │ │
│                                    │ Totale ricalcolato: 1.543,16 €           │ │
│                                    └──────────────────────────────────────────┘ │
│                          [ Annulla ]      [ Conferma ]                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

L'utente può, prima di confermare:
- spostare la scadenza,
- ridurre il premio RCA da 800 → 600,
- togliere la garanzia Furto.

Premendo **Conferma** (con AlertDialog di riepilogo), il backend in una transazione logica:

1. **Snapshot pre-evento** in nuova tabella `titoli_eventi_snapshot` (titolo + garanzie + veicolo serializzati in `payload_jsonb`).
2. Applica i cambi live a `titoli` (date/scadenza/premio_lordo) + upsert/delete su `premi_garanzia_polizza` + (se RCA, per la sostituzione) `veicoli_polizza`.
3. Esegue l'azione evento: per Sospensione → `stato='sospeso'`, cancella quietanze future non incassate, scrive `data_sospensione` + `limite_riattivazione` + `motivo_sospensione`.
4. Upload allegato in `documenti_titoli` → record in `documenti`.
5. Movimento `SO` in `movimenti_polizza`.
6. Log unificato in `log_attivita` con riferimento allo snapshot.

La "vecchia polizza" resta consultabile dal tab **Log Attività** con un pulsante "Vedi snapshot pre-evento" che apre un modal read-only con i dati di prima.

Stesso schema identico per Riattivazione, Sostituzione, Estinzione: cambia solo la colonna evento a sinistra.

---

## Implementazione

### 1. Database (migration)

Nuova tabella `titoli_eventi_snapshot`:
- `titolo_id uuid` (FK)
- `tipo_evento text` (`sospensione|riattivazione|sostituzione|estinzione`)
- `evento_at timestamptz default now()`
- `created_by uuid`
- `payload_jsonb jsonb` — contiene `{ titolo: {...}, garanzie: [...], veicolo: {...} }` pre-evento
- RLS: select per chi può leggere il titolo; insert solo via SECURITY DEFINER `log_evento_snapshot(titolo_id, tipo, payload)`.

### 2. Componente condiviso `<PolizzaEditorInline />`

Nuovo file `src/components/polizze/PolizzaEditorInline.tsx`: estrae da TitoloDetail/VociRcaCard la UI minima per editare:
- date (`garanzia_da`, `garanzia_a`, `data_scadenza`),
- frazionamento (read-only),
- tabella garanzie (sottoramo, netto, accessori, tasse, lordo) con add/remove riga, totale ricalcolato.
- (solo Sostituzione) blocco "Parametri oggetto" già esistente nel SostituzioneDialog → spostato qui.

Espone `value` + `onChange` come stato controllato (nessuna scrittura DB diretta).

### 3. Refactor dei 4 dialog

In ciascuno (`SospensionePolizzaDialog`, `RiattivazionePolizzaDialog`, `SostituzionePolizzaDialog`, `EstinzionePolizzaDialog`):
- `DialogContent` → `max-w-4xl max-h-[90vh] overflow-y-auto`, layout `grid grid-cols-1 lg:grid-cols-[1fr_1.2fr]`.
- A sinistra: campi attuali dell'evento (data, motivo, allegato, ecc.).
- A destra: `<PolizzaEditorInline titoloId=... value={polizzaDraft} onChange={setPolizzaDraft} />`.
- La mutation diventa unica e in sequenza fa: `log_evento_snapshot` → apply diff polizza/garanzie → azione evento attuale → upload doc → movimento → log.
- Conferma con AlertDialog di riepilogo (mantenuto).

### 4. UI snapshot storico

Nel tab **Log Attività** del titolo, per le righe con `azione in (sospensione_polizza, riattivazione_polizza, sostituzione_polizza, estinzione_polizza)` aggiungere bottone **"Vedi snapshot pre-evento"** → modal read-only che renderizza `payload_jsonb` come la vecchia polizza.

### 5. Verifica

Test manuale su `/titoli/2d40a2f9-…`:
1. Apri Sospendi → modifica scadenza + un premio garanzia → Conferma → ricarica → polizza aggiornata, log mostra snapshot pre-evento con i valori vecchi.
2. Ripeti per Riattiva, Sostituisci, Estingui.
3. Verifica che le quietanze future restino cancellate dove previsto e che il movimento + log siano scritti una sola volta.

---

## Cosa NON cambia

- Pulsanti azione (`Sospendi`, `Riattiva`, ecc.) e loro posizione in `TitoloDetail`.
- Logica conguaglio sostituzione (resta in colonna sinistra del SostituzioneDialog).
- RLS e trigger esistenti su `titoli` / `premi_garanzia_polizza` (lock_premi_storici continua a valere → snapshot serve proprio per ricostruire lo storico bloccato).
- Memorie `quietanza-isolation` e `policy-suspension-rules` restano valide.

## Note tecniche

- `lock_premi_storici` blocca modifiche ai premi se garanzia_a è > 7 gg fa e stato = incassato: in quel caso l'editor mostra le garanzie in read-only con avviso "premi bloccati: usa Appendice". Quindi la mutation NON tenta upsert su garanzie immutabili.
- `payload_jsonb` salvato come copia profonda — niente PII oltre a quanto già in `titoli`/`veicoli_polizza`.
- Aggiunta entry in `mem://insurance/policy-event-dialogs` dopo il merge per documentare il pattern.
