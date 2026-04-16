

## Piano: Rendere "Incassi e Coperture" una pagina di sola consultazione

### Problema
La pagina Contabilità Ufficio (`/contabilita`) contiene elementi operativi che non devono stare qui:
- Pulsante **"Conferma"** nelle righe del riepilogo messa a cassa (e relativo dialog rimessa)
- Tab **Movimenti**, **Estratti Conto**, **Incroci** con i rispettivi pulsanti "Nuovo Movimento" e "Nuovo Estratto"
- KPI Entrate/Uscite/Saldo/Anomalie KO (derivati dai movimenti/estratti che vengono rimossi)

La pagina deve essere **solo riepilogo consultivo** delle polizze messe a cassa (sia con incasso normale che conferimento gestito), con filtri e visualizzazione.

### Modifiche su `src/pages/ContabilitaUfficio.tsx`

**Rimuovere:**
1. Tutto il blocco Tabs (Movimenti, Estratti Conto, Incroci) — righe 552-707
2. Il pulsante "Conferma" nella tabella riepilogo — righe 448-452
3. La colonna vuota per il pulsante Conferma nell'header — riga 433
4. Il dialog "Conferma Rimessa" — righe 510-550
5. I 4 KPI cards (Entrate, Uscite, Saldo, Anomalie KO) — righe 354-401
6. Tutte le mutation e state correlati: `confirmMutation`, `createMovMutation`, `createEstMutation`, `verificaIncrocioMutation`, `verificaManualeMutation`, stati form movimento/estratto, queries `movimenti`, `estratti`, `incroci`, `compagniaIban`
7. Import non più necessari (Dialog, Tabs, Plus, ecc.)

**Aggiungere/Mantenere:**
1. Il **Riepilogo Messa a Cassa** per mese (già presente) — solo consultazione, senza pulsante Conferma
2. Aggiungere nella tabella espansa un **badge** per i titoli con `conferimento_gestito` e lo stato `fondi_ricevuti`
3. Aggiungere **KPI** pertinenti: Totale titoli messi a cassa, Totale premio lordo, Totale provvigioni, Totale da rimettere (derivati dal riepilogo già calcolato in `totaliCassa`)
4. Aggiungere un **filtro ricerca** per nome compagnia/titolo nel riepilogo
5. Titolo e sottotitolo aggiornati: "Incassi e Coperture" / "Riepilogo consultivo delle polizze messe a cassa"

### Risultato
La pagina mostrerà solo il riepilogo mensile per compagnia delle polizze incassate, espandibile per vedere i singoli titoli, con badge per conferimento gestito e stato fondi. Nessuna azione operativa.

### File coinvolti
- `src/pages/ContabilitaUfficio.tsx` — riscrittura significativa (rimozione ~60% del codice)

