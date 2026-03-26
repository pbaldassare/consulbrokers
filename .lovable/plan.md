

## Piano: Aggiungere colonna "Polizze Attive" alla lista clienti

### Cosa cambia

Aggiungere una colonna **"Polizze"** in entrambe le tab (Privati e Aziende) che mostra il conteggio delle polizze attive per ogni cliente.

### Implementazione

**File: `src/pages/ClientiList.tsx`**

1. **Query clienti**: modificare la select per includere un conteggio dei titoli collegati, usando una seconda query sui `titoli` raggruppati per `cliente_anagrafica_id` con stato `'incassato'` o altro stato attivo, oppure fare un join. Approccio pratico: query separata sui titoli per contare polizze attive per cliente, poi merge client-side.

2. **Nuova query**: aggiungere una query `useQuery` che recupera il conteggio polizze attive raggruppate per `cliente_anagrafica_id`:
   ```ts
   const { data: polizzeCounts } = useQuery({
     queryKey: ["polizze-count-per-cliente"],
     queryFn: async () => {
       const { data } = await supabase
         .from("titoli")
         .select("cliente_anagrafica_id")
         .not("cliente_anagrafica_id", "is", null)
         .in("stato", ["incassato","in_lavorazione","sospeso"]);
       // Contare client-side
       const counts: Record<string, number> = {};
       for (const t of data || []) {
         counts[t.cliente_anagrafica_id] = (counts[t.cliente_anagrafica_id] || 0) + 1;
       }
       return counts;
     }
   });
   ```

3. **Colonna nella tabella Privati**: aggiungere `<TableHead>Polizze</TableHead>` e nella riga `<TableCell>{polizzeCounts?.[c.id] || 0}</TableCell>` con un Badge colorato.

4. **Colonna nella tabella Aziende**: stesso aggiornamento.

5. **Aggiornare colSpan** dei messaggi "Nessun cliente" da 8 a 9.

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| File modificato | `src/pages/ClientiList.tsx` |
| Query aggiuntiva | Select su `titoli` filtrando stati attivi, conteggio client-side per `cliente_anagrafica_id` |
| Colonna | Badge con numero, posizionata dopo "Città" e prima di "Stato" |

