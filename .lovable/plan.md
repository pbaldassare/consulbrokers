Abilitare la cancellazione di polizze e quietanze (rate) dal database, dalla scheda **Polizze del cliente**.

## Cosa cambia

### 1. UI — `src/pages/ClienteDetail.tsx` (componente `PolizzeClienteTable`)
- Aggiungo una colonna "Azioni" con un'icona cestino su ogni riga (solo per `admin`).
- **Click su cestino della Polizza madre** → dialog di conferma "Eliminare la polizza N. XXXX e tutte le sue N quietanze?" → cancella in un colpo solo madre + tutte le rate.
- **Click su cestino di una Quietanza** → dialog "Eliminare la quietanza N. XXXX?" → cancella solo quel record.
- Dopo la cancellazione: invalido le query `["cliente_polizze", id]`, toast di conferma.
- Niente cancellazione se la polizza è in stato `messa a cassa` o `stornata` (lock UI esistente per coerenza con la regola "isolamento quietanze"). Solo bottone disabilitato con tooltip esplicativo.

### 2. Database — nuova policy RLS DELETE per admin su `titoli`
Attualmente esistono solo policy DELETE per ruolo `ufficio`. Aggiungo:
```sql
CREATE POLICY "Admin delete titoli"
ON public.titoli FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));
```
Le righe collegate (`titoli_split_commerciali`, `premi_garanzia_polizza`, log audit, ecc.) vengono ripulite via `ON DELETE CASCADE` esistenti; se manca un cascade su qualche FK, lo aggiungo nella stessa migration.

### 3. Note
- La cancellazione è **fisica** (DELETE), non logica.
- L'audit trigger esistente registra l'evento di delete in automatico.
- Non tocco la logica di `Messa a Cassa` / auto-quietanza: resta intatta.

Confermi e procedo?