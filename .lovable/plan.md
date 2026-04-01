

## Piano: Fix visibilità Compagnie e Rami per utente cliente

### Problema
Le tabelle `compagnie` e `rami` hanno RLS policies che permettono SELECT solo a ruoli `admin`, `cfo`, `ufficio`, `produttore`, ecc. — ma **nessuna policy per il ruolo `cliente`**. Quindi i join nelle query (`compagnie(nome)`, `rami(descrizione)`) restituiscono `null`, mostrando "—" nella pagina dettaglio polizza e impedendo statistiche corrette nella dashboard.

### Soluzione: 1 migrazione SQL

Aggiungere policy SELECT su `compagnie` e `rami` per il ruolo `cliente` (read-only):

```sql
CREATE POLICY "Cliente select compagnie"
ON public.compagnie FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'cliente'));

CREATE POLICY "Cliente select rami"
ON public.rami FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'cliente'));
```

### Risultato
- Dettaglio polizza mostrerà Compagnia e Ramo correttamente
- Tabella polizze mostrerà i nomi compagnia reali
- Grafici dashboard/sinistri avranno dati ramo corretti

### File coinvolti

| File | Azione |
|------|--------|
| Migrazione SQL | 2 policy SELECT per cliente su compagnie + rami |

Nessuna modifica ai file frontend — le query già fetchano i dati correttamente.

