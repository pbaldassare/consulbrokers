

## Piano: Rimessa Premi e Provvigioni basate sulla Messa a Cassa

### Obiettivo
Collegare la pagina Rimessa Premi al mese corrente mostrando solo i titoli "messi a cassa" nel mese selezionato. Stessa logica per Provvigioni Consul.

### 1. Rimessa Premi (`src/pages/RimessaList.tsx`)
- Aggiungere un selettore mese (come nel Carico del Mese: frecce sx/dx + label mese/anno)
- Rimuovere filtro "Tutte le compagnie" dalla lista
- Default: mese corrente
- Il pulsante "Nuova Rimessa" nel dialog passa anche il range date del mese selezionato
- Sotto la lista rimesse, aggiungere una sezione "Titoli messi a cassa nel mese" che mostra un riepilogo raggruppato per compagnia dei titoli con `stato = 'incassato'` e `data_messa_cassa` nel range del mese selezionato, non ancora associati a una rimessa

### 2. Edge function `gestione-rimessa` (`supabase/functions/gestione-rimessa/index.ts`)
- Aggiungere parametri `data_da` e `data_a` nell'azione `crea`
- Filtrare i titoli incassati anche per `data_messa_cassa` nel range specificato (non più tutti gli incassati di sempre)

### 3. Provvigioni Consul (`src/pages/ProvvigioniSedePage.tsx`)
- Sostituire i filtri data liberi con il selettore mese (stile Carico del Mese)
- Filtrare i titoli per `data_messa_cassa` nel range del mese selezionato (solo quelli effettivamente incassati)
- Mantenere il filtro compagnia opzionale

### File coinvolti
- `src/pages/RimessaList.tsx` — selettore mese, rimuovi filtro compagnia, riepilogo titoli incassati
- `src/pages/ProvvigioniSedePage.tsx` — selettore mese, filtro per data_messa_cassa
- `supabase/functions/gestione-rimessa/index.ts` — filtro per range date nella creazione rimessa

