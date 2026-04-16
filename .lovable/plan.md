

## Piano: Fix importo_incassato mancante + visibilità dati

### Problema
Il flusso "Incassi e Coperture" (PortafoglioCaricoPage) quando mette a cassa un titolo setta `stato = 'incassato'`, `data_messa_cassa`, `data_incasso`, `data_pagamento` — ma **NON setta `importo_incassato`**, che resta NULL. Di conseguenza E/C Compagnia mostra i titoli con importo 0,00€.

I 3 titoli attuali incassati hanno `premio_lordo` valorizzato (784€, 2000€, 243€) ma `importo_incassato = NULL`.

### Modifiche

**1. `src/pages/PortafoglioCaricoPage.tsx`** — Aggiungere `importo_incassato: premio_lordo` nell'update di messa a cassa (sia singolo che bulk). L'importo incassato deve corrispondere al premio lordo al momento della messa a cassa.

Righe interessate:
- Riga ~93: update singolo → aggiungere `importo_incassato: titolo.premio_lordo`  
- Riga ~130: annullamento → aggiungere `importo_incassato: null`
- Riga ~168: bulk messa a cassa → aggiungere `importo_incassato: p.premio_lordo`
- Riga ~200: bulk annullamento → aggiungere `importo_incassato: null`

Il problema: l'update singolo (riga 93) non ha accesso al `premio_lordo` del titolo. Serve passarlo come parametro o fare la query prima.

**2. Migrazione SQL** — Aggiornare i 3 titoli esistenti per popolare `importo_incassato = premio_lordo`:

```sql
UPDATE titoli
SET importo_incassato = premio_lordo
WHERE stato = 'incassato'
  AND importo_incassato IS NULL;
```

**3. Nessuna modifica a E/C Compagnia** — la pagina già usa `importo_incassato`, basta che sia valorizzato.

### Risultato
- E/C Compagnia mostrerà le 3 compagnie con i totali corretti
- Il flusso futuro di messa a cassa popolerà sempre `importo_incassato`
- La rimessa potrà calcolare importi corretti

