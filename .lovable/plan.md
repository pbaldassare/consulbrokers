

## Piano: Ristrutturare Rimessa Premi come riepilogo automatico

### Obiettivo
Rimuovere il pulsante "Nuova Rimessa" e trasformare la pagina in un riepilogo automatico dei premi messi a cassa nel mese, divisi per compagnia, con il calcolo del premio da rimettere (premio lordo − provvigioni).

### Calcolo
- **Premio da rimettere** = `premio_lordo - (provvigioni_firma + provvigioni_quietanza)`
- Subtotali per compagnia: n° titoli, totale premio lordo, totale provvigioni, totale da rimettere

### Modifiche su `src/pages/RimessaList.tsx`

1. **Rimuovere** il pulsante "Nuova Rimessa", il Dialog di creazione, la mutation `createMutation`, e gli stati `open`, `compagniaId`, `ufficioId`
2. **Aggiornare la query `titoli-cassa-mese`** per selezionare anche `premio_lordo`, `provvigioni_firma`, `provvigioni_quietanza` (non solo `importo_incassato`)
3. **Raggruppare per compagnia** con subtotali: n° titoli, totale premio lordo, totale provvigioni (firma + quietanza), totale netto da rimettere
4. **Mostrare la tabella riepilogativa** con colonne: Compagnia | Titoli | Premio Lordo | Provvigioni | Da Rimettere
5. **Riga totale generale** in fondo alla tabella
6. **Mantenere** la sezione Rimesse esistenti sotto (lista storica) e il selettore mese

### File coinvolto
- `src/pages/RimessaList.tsx`

