

## Piano: Collegare Messa a Cassa ai dati E/C Compagnia

### Problema
Il tab "Estratto Conto" in E/C Compagnia attualmente mostra **tutti i titoli** indipendentemente dallo stato. Quando si conferma la "Messa a Cassa" in Incassi e Coperture (stato → `incassato`), quei dati non vengono filtrati correttamente nell'E/C Compagnia.

### Cosa cambia

**1. Filtrare titoli per `stato = 'incassato'` nel tab Estratto Conto**
- La query attuale (riga 72-98 di `ECCompagniaContabPage.tsx`) non filtra per stato. Aggiungere `.eq("stato", "incassato")` per mostrare solo i titoli messi a cassa.

**2. Aggiungere colonna "Da Rimettere" e "Già Rimesso"**
- Calcolare `da_rimettere = lordo - provvigioni` per ogni compagnia
- Incrociare con `rimessa_premi` per mostrare quanto è già stato rimesso e quanto resta da rimettere
- Aggiungere le colonne nella tabella: Lordo, Provvigioni, **Già Rimesso**, **Da Rimettere**

**3. Aggiornare i KPI**
- Aggiungere KPI "Da Rimettere" e "Già Rimesso" accanto ai KPI esistenti

**4. Aggiungere filtro per `data_messa_cassa`**
- I filtri periodo (`periodo_dal`, `periodo_al`) dovrebbero applicarsi su `data_messa_cassa` (non `data_incasso`) per coerenza col flusso di cassa

### File coinvolti
- **`src/pages/contabilita/ECCompagniaContabPage.tsx`** — query filtrata per incassato, aggiunta calcolo rimesse, nuove colonne e KPI

