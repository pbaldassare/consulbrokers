

## Diagnosi

L'errore RLS persiste anche dopo il fix delle policy `titoli` e `movimenti_polizza`. Servono dati concreti prima di toccare altro: voglio vedere il messaggio esatto + la policy che blocca.

## Cosa controllo prima di proporre fix

1. **Errore esatto in console**: leggo i console logs per capire QUALE policy blocca (titoli? movimenti_polizza? log_attivita?) e su QUALE colonna.
2. **Policy attuali**: rileggo le policy INSERT su `titoli`, `movimenti_polizza`, `log_attivita` per il ruolo `ufficio` (Giuliano è Responsabile Ufficio, NON admin).
3. **Codice del dialog**: rivedo `RinnovoTitoloDialog.tsx` per vedere cosa effettivamente passa nell'INSERT.

## Ipotesi forte

Il fix precedente ha sistemato la policy **admin**, ma Giuliano è ruolo `ufficio`. Probabilmente:
- La policy INSERT su `titoli` per `ufficio` richiede `ufficio_id = get_my_ufficio_id()` ✅ (già gestito)
- MA potrebbe richiedere anche altri vincoli (es. `produttore_id = auth.uid()` oppure `created_by`)
- OPPURE il blocco è su `movimenti_polizza` (policy ufficio mancante o stretta)
- OPPURE su `log_attivita` (policy INSERT che richiede `user_id = auth.uid()` non rispettata)

## Piano d'azione

1. Leggere console logs → identificare tabella + colonna che fallisce
2. Query `pg_policies` per vedere tutte le policy INSERT su quelle 3 tabelle
3. Confrontare con il payload che il dialog manda
4. Aggiungere policy INSERT mancante per ruolo `ufficio` (con `WITH CHECK ufficio_id = get_my_ufficio_id()`) sulla tabella incriminata, e/o correggere il payload nel dialog

## Cosa farò una volta in modalità default

- Migrazione SQL per aggiungere/correggere la policy `INSERT` per il ruolo `ufficio` sulla tabella che fallisce (probabilmente `movimenti_polizza` o `log_attivita`)
- Eventuale piccolo aggiustamento al payload in `RinnovoTitoloDialog.tsx` se manca un campo richiesto dalla policy

## File toccati (previsti)

- 1 nuova migrazione SQL
- Eventualmente `src/components/polizze/RinnovoTitoloDialog.tsx`

Nessuna modifica strutturale: solo policy + payload.

