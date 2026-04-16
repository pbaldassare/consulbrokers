

## Piano: Abilitare accesso completo ai titoli per Segreteria (Ufficio di Napoli)

### Problema
- L'utente `segreteria@consulbrokers.it` è assegnato correttamente a **Ufficio di Napoli** (`f5163c49`)
- I **clienti** (548) sono quasi tutti sotto Napoli — OK
- I **titoli** hanno un problema: 1037 su 1047 hanno `ufficio_id = NULL`, quindi la RLS policy `ufficio_id = get_my_ufficio_id()` non li matcha
- Inoltre mancano le policy **INSERT/UPDATE/DELETE** su `titoli` per il ruolo `ufficio` — l'utente può solo leggere

### Soluzione

**1. Assegnare `ufficio_id = Napoli` ai titoli con ufficio NULL**
- UPDATE dei 1037 titoli che hanno `ufficio_id IS NULL` per impostarli a Napoli (`f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a`)
- Questo fa funzionare la RLS SELECT esistente senza modificarla

**2. Aggiungere policy di scrittura per ruolo `ufficio` su `titoli`**
Migrazione SQL con 3 nuove RLS policies:
- **INSERT**: `with_check (ufficio_id = get_my_ufficio_id())`
- **UPDATE**: `using (ufficio_id = get_my_ufficio_id())`
- **DELETE**: `using (ufficio_id = get_my_ufficio_id())`

### Dettagli tecnici
- L'update dei dati avviene tramite il tool insert (UPDATE statement)
- Le 3 policy vengono create con una migrazione SQL
- Nessuna modifica al codice frontend
- L'ufficio resta Napoli come richiesto

