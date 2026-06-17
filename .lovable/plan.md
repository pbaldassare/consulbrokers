## Ho capito: serve eseguire l'operazione e salvarla, non solo filtrare

In `/portafoglio/gestione` le card in alto (Appendice, Storno, Rinnovo, Duplica, Sostituzione, Sospensione, Riattivazione, Annulla, Messa a Cassa, Annulla M.C., Carica Doc., Precontrattuale, CIG Temporanei, Regolazioni Attese) **non sono filtri**: sono **operazioni** che devono produrre un record nuovo / una modifica persistente nel database sulla polizza scelta.

### Stato attuale (cosa fa oggi "Esegui" riga per riga)

| Operazione | Comportamento attuale | Persiste in DB? |
|---|---|---|
| Storno | Apre `StornoTitoloDialog` inline | ✅ sì (scrive `titoli_storni` + aggiorna `titoli`) |
| Duplica | Apre `DuplicaPolizzaDialog` inline | ✅ sì (insert in `titoli`) |
| Sospensione / Riattivazione / Sostituzione / Messa a Cassa / Annulla / Annulla M.C. | Aprono i rispettivi dialog inline | ✅ sì |
| **Appendice** | Naviga a `/portafoglio/appendici?titoloId=…` (devi cliccare ancora "Nuova appendice" lì) | ❌ non crea nulla qui |
| **Rinnovo** | Naviga a `/portafoglio/rinnovi?titoloId=…` | ❌ non crea nulla qui |
| **Precontrattuale** | Naviga a `/portafoglio/doc-precontrattuale?titoloId=…` | ❌ |
| **Carica Doc.** | Naviga a `/titoli/:id?tab=documenti` | ❌ |
| CIG Temporanei / Regolazioni Attese | Naviga al dettaglio titolo | ❌ (sono più "viste" che operazioni) |

Quindi il pattern è incoerente: alcune operazioni si **completano in-page** con dialog, altre invece **scappano via** verso un'altra pagina e ti costringono a un secondo click per creare davvero il record.

### Piano

Rendere `/portafoglio/gestione` la **vera centrale operativa**: clic su card → filtra → "Esegui" → si apre un dialog che salva subito in DB e torna sulla stessa pagina (toast + refresh tabella). Niente più redirect a pagine intermedie.

1. **Appendice** — `esegui` apre un nuovo `AppendiceDialog` inline (riusando la logica di `AppendiciPolizzaPage`):
   - campi: numero appendice (precompilato = max+1), data appendice, descrizione, file opzionale
   - submit → insert in `appendici_polizza` + `log_attivita`, toast, invalidate query.

2. **Rinnovo** — apre un `RinnovoDialog` inline che crea il titolo di rinnovo (insert in `titoli` con `sostituisce_polizza`/date traslate secondo frazionamento), invece di portare a `/portafoglio/rinnovi`. Mantiene comunque il link "Apri in pagina dedicata" per i casi complessi.

3. **Precontrattuale** — apre un `PrecontrattualeDialog` inline che genera il PDF (riuso `lib/precontrattuale-pdf.ts`), lo salva in storage + riga `documenti`, toast.

4. **Carica Doc.** — apre un `CaricaDocDialog` inline con dropzone (riuso del pannello documenti del titolo): upload → bucket + riga `documenti` collegata al titolo.

5. **CIG Temporanei / Regolazioni Attese** — restano "viste filtrate" perché non sono operazioni di scrittura; rinominare il loro `Esegui` in **"Apri"** per chiarezza (e tenere il deep link al dettaglio).

6. **Tracciamento**: ogni operazione scrive una riga in `log_attivita` (entità=`titolo`, azione=`appendice_creata|rinnovo_creato|...`) così la storia è auditabile dal pannello "Attività Recenti" già presente nella pagina.

7. **UX**: dopo ogni operazione → `toast.success`, `queryClient.invalidateQueries` sui titoli + sulla card affetta, niente navigazione via.

### Dettagli tecnici

- File toccati: `src/pages/GestionePolizzePage.tsx` (sostituire i `navigate(...)` di Appendice/Rinnovo/Precontrattuale/Carica Doc. con apertura di dialog) + 4 nuovi dialog in `src/components/polizze/azioni/`:
  - `AppendiceDialog.tsx`
  - `RinnovoDialog.tsx`
  - `PrecontrattualeDialog.tsx`
  - `CaricaDocDialog.tsx`
- Niente modifiche a schema DB: tutte le tabelle esistono già (`appendici_polizza`, `titoli`, `documenti`, `log_attivita`).
- Niente modifiche RLS.
- Test E2E: aggiornare `tests/e2e/11-gestione-polizze-operazioni.spec.ts` — al posto di verificare l'URL, verificare che il dialog si apra, che il submit produca toast e che il record compaia nella tabella/DB.

### Fuori scopo (per ora)

- Non tocco Storno/Duplica/Sospensione/Riattivazione/Sostituzione/Messa a Cassa/Annulla/Annulla M.C.: già funzionano correttamente con dialog inline.
- Non rimuovo le pagine dedicate `/portafoglio/appendici`, `/portafoglio/rinnovi`, `/portafoglio/doc-precontrattuale`: restano per accesso diretto / casi avanzati.
