

## Piano: Rimuovere colonna e ordinamento "Polizze" dalla lista Clienti

### Cosa rimuovere in `src/pages/ClientiList.tsx`

1. **Query `polizzeCounts`** (righe ~275-283): eliminare la useQuery che chiama `count_polizze_per_cliente`
2. **Opzione di ordinamento "polizze"**: cambiare il default di `sortBy` da `"polizze"` a `"cognome"`, rimuovere il caso `sortBy === "polizze"` nella funzione sort, rimuovere il `<SelectItem value="polizze">` dal select di ordinamento
3. **Colonna "Polizze" nel tab Privati** (~righe 1102, 1116-1120): rimuovere `<TableHead>Polizze</TableHead>` e la relativa `<TableCell>` con il badge
4. **Colonna "Polizze" nel tab Aziende** (~righe 1159, 1173-1177): stessa rimozione
5. **Colonna "Polizze" nel tab Enti** (~righe 1216, 1230-1234): stessa rimozione

### Risultato
- La lista clienti non mostra piu la colonna Polizze
- L'ordinamento di default diventa per cognome A-Z
- Nessuna query extra verso `count_polizze_per_cliente`

