

## Piano: Mostrare numero polizze per cliente nella lista clienti

### Situazione attuale
- Tutti i **1035 titoli** sono già collegati ai clienti tramite `cliente_anagrafica_id` (0 senza cliente)
- Esiste già la funzione DB `count_polizze_per_cliente()` che restituisce `(cliente_id, count)`
- La lista clienti (`ClientiList.tsx`) non mostra il conteggio polizze

### Modifiche

**File: `src/pages/ClientiList.tsx`**

1. Aggiungere una query separata che chiama `count_polizze_per_cliente()` via RPC e costruisce una mappa `cliente_id → num_polizze`
2. Aggiungere la colonna **"Polizze"** nella tabella, tra "Città" e "Stato"
3. Mostrare il conteggio con un Badge colorato (evidenziato se > 0)
4. Aggiornare il `colSpan` della riga "Nessun cliente trovato"

La colonna mostrerà un badge numerico per ogni cliente, rendendo immediatamente visibile quante polizze ha ciascuno.

### Dettagli tecnici
- Uso di `supabase.rpc("count_polizze_per_cliente")` che è già una `SECURITY DEFINER` function
- La mappa viene costruita una volta e consultata per ogni riga della tabella
- Nessuna modifica al DB necessaria

