## Filtri + Export Excel sulla pagina Sinistri (Portale Cliente)

### 1. Filtri sopra le card KPI (`src/pages/cliente/ClienteSinistri.tsx`)
Aggiungere una barra filtri (Card compatta) sopra la griglia KPI con:
- **Ricerca testo libero**: n° sinistro, n° compagnia, controparte, targa
- **Stato**: multi-select (in_valutazione, aperto, in_lavorazione, in_attesa_documenti, in_liquidazione, chiuso, respinto) — popolato dinamicamente dai valori presenti
- **Garanzia / Ramo sinistro**: select da valori distinti
- **Compagnia**: select dai valori distinti (`compagnie.nome`)
- **Polizza**: select dai numeri titolo collegati
- **Provincia / Città**: due select dai distinti `provincia_sinistro` / `citta_sinistro`
- **Range data evento**: due DatePicker (da / a)
- **Bottone "Reset filtri"** + counter "X di Y sinistri"

I filtri agiscono client-side sul dataset già caricato (`sinistri`); KPI, grafici e tabella usano la lista filtrata.

### 2. Selezione righe per export
- Checkbox in testa tabella ("seleziona tutti i filtrati") + checkbox per riga
- Stato `selectedIds: Set<string>`
- Toolbar sopra la tabella mostra "N selezionati" + bottone **"Esporta Excel"** (disabilitato se 0)
- Se nessuna riga selezionata ma si clicca un secondo bottone **"Esporta tutti i filtrati"**, esporta l'intero risultato filtrato

### 3. Export Excel con dati polizza completi
Nuovo handler `handleExport()`:
1. Per gli ID selezionati, recupera i sinistri (già in memoria) + fetch parallelo polizze:
   ```ts
   supabase.from("titoli").select("*, compagnie(nome,codice), rami(codice,descrizione), clienti(...)")
     .in("id", titoloIds)
   ```
2. Costruisce array di righe con **tutte le colonne sinistro** (numero, stato, ramo, date, luogo, importi, controparte, perito, dinamica, note) **+ tutti i campi polizza** rilevanti (numero, compagnia, ramo, prodotto, decorrenza, scadenza, frazionamento, premio netto/tasse/lordo, provv. firma/quietanza, CIG, targa/telaio, vincolo, tacito rinnovo, stato, produttore, ecc.)
3. Usa `xlsx` (già in deps) per generare workbook con due sheet:
   - **Sinistri**: una riga per sinistro con tutti i campi sinistro + polizza appaiati
   - **Polizze**: una riga per polizza unica coinvolta (dettaglio completo)
4. Download via `XLSX.writeFile(wb, 'sinistri_export_YYYYMMDD.xlsx')`

### 4. Note tecniche
- Nessuna modifica DB / RLS
- Riuso componenti UI esistenti (`SearchableSelect`, shadcn `Checkbox`, `Popover`, `Calendar`)
- I filtri restano client-side perché il dataset cliente è limitato (RLS già filtra ai suoi sinistri)
- File toccato: solo `src/pages/cliente/ClienteSinistri.tsx` (+ eventualmente un piccolo helper `src/lib/exportSinistriXlsx.ts` per tenere la pagina leggibile)
