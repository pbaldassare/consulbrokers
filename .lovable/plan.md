

## Piano: Rendere modificabili le 3 date della Messa a Cassa

### Obiettivo
Le tre date nella card "Messa a Cassa" (Data Messa a Cassa, Data Pagamento, Data Decorrenza Rinnovo) devono essere modificabili singolarmente tramite input date, con salvataggio immediato al cambio valore.

### Modifiche su `src/pages/TitoloDetail.tsx`

1. **Sostituire i `FieldRow` statici con input `type="date"`** per le 3 date, visibili solo quando la polizza e in stato "incassato"
2. **Aggiungere una mutation dedicata** per aggiornare singolarmente ciascuna data nella tabella `titoli` (update del campo specifico + invalidate query)
3. **Quando stato = "attivo"** le date restano in sola lettura (mostrano "—")
4. **Quando stato = "incassato"** ogni data diventa un campo `<Input type="date">` che al `onChange`/`onBlur` salva il nuovo valore

### Dettagli tecnici
- Usare `useMutation` con update su `supabase.from("titoli").update({ [campo]: valore }).eq("id", id)`
- Invalidare `["titolo", id]` dopo il salvataggio
- Stile coerente: label sopra, input sotto, griglia a 3 colonne come ora

