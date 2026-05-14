## Cosa cambia

### 1. Pagina E/C Produttori — semplificazione (`ECProduttoriContabPage.tsx`)
- **Rimuovo** la KPI "N. Produttori" (restano solo Totale Lordo e Totale Provvigioni).
- **Rimuovo** il radio `Con E/C` / `Tutti` (era un doppione: di default mostro **solo i produttori con movimenti**).
- **Rimuovo** il blocco "Parametri di Stampa" (Descrizione Periodo, Data E/C, Data Valuta) e il filtro "Data limite incassi": parametri inutili.
- **Aggiungo** filtro a badge **Mese corrente** / **Mese scorso** (toggle, default = Mese corrente). Il periodo viene calcolato automaticamente sui titoli `messi a cassa` di quel mese.
- Resta il `SearchableSelect` produttore + bottone Esporta CSV.

### 2. Eliminazione pagina intermedia (`ECProduttorePdfPage.tsx`)
- Il bottone "E/C PDF" sulla riga della tabella **NON** naviga più a `/contabilita/ec-produttore/pdf`.
- Genera direttamente l'anteprima PDF in un dialog con i 3 bottoni `[Anteprima] [Stampa] [Salva in archivio]`, in linea con il pattern usato in Incassi e Coperture.
- I dati statici del PDF (numero rendiconto, data, periodo, % RA, sede mittente) vengono presi automaticamente:
  - **Periodo** = etichetta del badge attivo (es. "Maggio 2026")
  - **Data rendiconto** = oggi
  - **Numero rendiconto** = progressivo automatico (1 fisso per ora)
  - **% RA** = `anagrafiche_professionali.percentuale_ra` del produttore
  - **Sede mittente** = ufficio dell'utente loggato (`profile.ufficio_id`)
- La pagina `ECProduttorePdfPage.tsx` e la rotta `/contabilita/ec-produttore/pdf` vengono **eliminate**.

### 3. PDF — filtro corretto (`ec-produttore-pdf.ts` + query)
Il PDF deve contenere **solo**:
- Titoli con `data_messa_cassa NOT NULL` (no in attesa di cassa, no stornati)
- `data_messa_cassa` dentro il mese del filtro (corrente o scorso)
- Solo le righe `provvigioni_generate` dove l'attribuzione è al produttore selezionato:
  - `tipo_destinatario = 'commerciale'` AND (`anagrafica_commerciale_id = produttoreId` OR fallback `user_id = produttoreId`)
  - escluse righe `solo_statistico = true` e righe `tipo_destinatario IN ('admin','sede')`

Nessuna modifica grafica al PDF — solo al dataset.

## Out of scope
- Nessuna modifica DB.
- Nessuna modifica al layout/visual del PDF.
- Logica analoga (E/C Clienti, E/C Agenzie) NON toccata in questo round.
