# Integrare voci RCA dentro la sezione "Importi"

L'utente vuole che la composizione delle garanzie RCA non sia un tab separato ma viva **dentro la card "Importi"**, con il **Totale Premio Lordo della sezione Importi calcolato come somma delle singole garanzie**, e con il dropdown di aggiunta/rimozione collegato al catalogo `rca_garanzie` (già il caso, ma da rendere più visibile).

## Modifiche

### 1. Spostare `<VociRcaCard />` dentro la sezione Importi (`TitoloDetail.tsx`)
- **Rimuovere** il tab `voci-rca` aggiunto in `TabsList` (righe ~2698-2700) e relativo `TabsContent`.
- **Aggiungere** il blocco `<VociRcaCard />` in fondo al contenuto della `SectionCollapsible` "Importi", visibile sia in modalità lettura sia in modalità modifica, sotto i due blocchi Firma/Quietanza, separato da un divisore orizzontale.
- Visibile solo se `isRamoAuto((t as any).ramo)`.

### 2. Sincronizzare i totali Importi ⇄ Voci RCA
- Quando l'utente modifica una voce (netto/aliquota/aggiunta/rimozione), `VociRcaCard` calcola il **nuovo lordo totale** = Σ lordi voci.
- Nuovo callback `onTotaliChange?(totali: { netto, tasse, lordo })` esposto da `VociRcaCard`.
- In `TitoloDetail`, quando il ramo è RCA: alla ricezione dell'evento, **aggiornare automaticamente** `titoli.premio_netto`, `titoli.tasse`, `titoli.premio_lordo` (UPDATE su titolo) e mostrare un piccolo badge "Aggiornato dalle voci RCA" nella card Importi. Debounced 800 ms per evitare scritture eccessive.
- Aggiunge anche un pulsante manuale **"Allinea importi alle voci"** in cima alla sezione Importi per i casi in cui l'utente abbia editato a mano e vuole forzare il riallineamento.
- I campi Premio Netto / Tasse / Premio Lordo della sezione Firma diventano **read-only con tooltip "Calcolato dalle voci RCA"** quando il ramo è RCA Auto, per evitare disallineamento.

### 3. Migliorare il dropdown "Aggiungi voce"
- Già usa `Popover + Command` letto da `rca_garanzie`. Migliorie:
  - Mostrare codice + descrizione + aliquota suggerita nella riga.
  - Raggruppare per famiglia (Furto/Incendio, Cristalli, Casko, Assistenza, Tutela, Infortuni, ARD, Diritti, Black Box) tramite `CommandGroup heading=`.
  - Pulsante più visibile dentro l'header della tabella voci ("`+ Aggiungi garanzia`") con stile primario teal.

### 4. Rimozione voce — già implementata con AlertDialog di conferma (lascio invariato).

## File toccati

- `src/pages/TitoloDetail.tsx` — sposta `VociRcaCard` da tab a sezione Importi, rimuove tab, aggiunge handler `onTotaliChange` + debounced UPDATE su titolo, rende Netto/Tasse/Lordo read-only su rami RCA con badge.
- `src/components/polizze/VociRcaCard.tsx` — espone prop `onTotaliChange`, raggruppa il catalogo per famiglia nel popover.

## Note tecniche

- Manteniamo i campi `titoli.premio_netto/tasse/premio_lordo` come **fonte di verità per la quadratura contabile** (rimesse, distinte, statement); le voci RCA li **alimentano** quando il ramo è auto.
- Nessuna modifica DB necessaria: tabella `premi_garanzia_polizza` già pronta (con campi aggiunti nella migrazione precedente).
- L'audit trail già attivo sulle voci continua a tracciare ogni aggiunta/modifica/rimozione.
