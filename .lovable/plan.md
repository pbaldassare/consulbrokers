## Verifica dati vs PDF allegato

Il PDF di esempio è un Rendiconto Provvigioni per produttore/commerciale ("ASSICURASUD SRL"), con una tabella di righe e totali finali con Ritenuta d'Acconto e netto a credito. Tutti i dati richiesti sono già nel database.

### Mappatura campi PDF → DB

| Campo PDF | Origine |
|---|---|
| Mittente (Consulbrokers, sedi, P.IVA, REA, RUI) | costanti del PDF (già in `ec-cliente-pdf.ts`) |
| Destinatario (ragione sociale, indirizzo, città, prov, CAP) | `anagrafiche_professionali` (ragione_sociale/cognome+nome, indirizzo, cap, citta, provincia) |
| Rendiconto n. / data | input utente (Descrizione Periodo, Data E/C già presenti nei filtri) |
| Periodo intermediazioni | input utente (Descrizione Periodo) |
| Riga: Data | `titoli.data_messa_cassa` (o `data_incasso` se mancante) |
| Riga: Polizza Delegataria | `titoli.numero_titolo` (+ `riga` se valorizzato → "n - r") |
| Riga: Cliente/Note | `clienti.ragione_sociale` o `cognome nome` (via `cliente_anagrafica_id`) |
| Riga: Ramo | `rami.descrizione` |
| Riga: Periodo | `garanzia_da` – `garanzia_a` |
| Riga: tp (PI/PQ/AM) | derivato: `appendice IS NOT NULL` → AM; `sostituisce_polizza IS NOT NULL` → PQ; altrimenti PI |
| Riga: Premio | `titoli.premio_lordo` |
| Riga: Provvigioni | `provvigioni_generate.importo_provvigione` (somma per titolo+user_id) |
| Riga: altre oper | 0,00 (placeholder, non c'è gestione separata) |
| Totali Premio / Provvigioni | somma colonne |
| Debito/Credito | totale provvigioni |
| Ritenuta d'Acconto | totale provvigioni × `anagrafiche_professionali.percentuale_ra` (default 11,50% se nullo, come da PDF: 1.342,20 / 11.671,34 ≈ 11,5%) |
| A Vostro Credito | provvigioni − ritenuta |
| Note legali (Esente IVA / bollo) | costanti |

**Conclusione**: abbiamo tutti i dati. Unica derivazione è il codice **tp** (PI/PQ/AM) calcolato dalle colonne `appendice` e `sostituisce_polizza` di `titoli`.

## Cosa implementare

1. **`src/lib/ec-produttore-pdf.ts`** (nuovo)  
   Generatore PDF in stile uguale a `ec-agenzia-pdf.ts` / `ec-cliente-pdf.ts`: header con logo, mittente, destinatario, "Rendiconto n. … del …", tabella 8 colonne (Data | Polizza | Cliente | Ramo/Periodo | tp | Premio | Provvigioni | Altre op.), riepilogo finale (Totale Premio, Totale Provvigioni, Debito/Credito, Ritenuta Acconto, A Vostro Credito), note legali, footer Consulbrokers. Restituisce `Uint8Array`.

2. **`src/pages/contabilita/ECProduttorePdfPage.tsx`** (nuovo)  
   Pagina dedicata `/contabilita/ec-produttori/:produttoreId/pdf` (analoga a `ECAgenziaPdfPage` / `ECClientePdfPage`). Carica:
   - anagrafica produttore (per intestazione + percentuale_ra)
   - provvigioni del produttore filtrate per periodo (parametri da query string)
   - join con `titoli`, `clienti`, `rami`
   - Calcola righe + totali e renderizza:
     - Anteprima a video (iframe `application/pdf` blob)
     - Pulsanti: **Anteprima**, **Stampa**, **Scarica PDF** (download diretto senza salvare), **Salva PDF in archivio** (insert in `documenti` + upload bucket, come per cliente/agenzia)

3. **Aggiornamento `ECProduttoriContabPage.tsx`**  
   - Per ogni riga: pulsante "Anteprima/Stampa" che apre la nuova pagina con i parametri (`produttore_id`, `data_limite_incassi`, `desc_periodo`, `data_ec`, `data_valuta`).
   - Pulsante in toolbar "Anteprima E/C" attivo quando è selezionato un singolo produttore.

4. **`src/pages/contabilita/ECProduttoriStoricoPage.tsx`** (nuovo)  
   Pagina elenco PDF salvati per produttori: filtri (ricerca, produttore, periodo, paginazione 25), download diretto da `bucket_name` + `path_storage` come per E/C clienti/agenzie. Filtra `documenti` per `categoria = 'ec_produttore'`.

5. **Routing & Navigazione**  
   - `src/routes/contabilita.tsx`: registrare le 2 nuove route (`ec-produttori/:id/pdf` e `ec-produttori/storico`).
   - `src/components/AppSidebar.tsx`: aggiungere voce "Storico E/C Produttori" sotto Contabilità Ufficio.
   - `src/pages/EstrazioniStampePage.tsx`: card per accedere allo storico produttori.

6. **Migrazione**: nessuna modifica schema. La categoria `ec_produttore` viene scritta come stringa nei `documenti` (in linea con `ec_cliente` e `ec_agenzia`).

## Note tecniche
- Determinazione `tp`: `appendice ? 'AM' : (sostituisce_polizza ? 'PQ' : 'PI')`.
- Ritenuta d'acconto: `percentuale_ra` da anagrafica produttore; fallback 11.50%.
- I dati salvati nel record archivio (snapshot dei filtri) saranno usati al re-download per garantire idempotenza.
