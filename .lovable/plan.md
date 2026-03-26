

## Piano: Provvigioni Automatiche per Prodotto nella Creazione Polizza

### Concetto compreso

Il flusso e:

1. **Seleziono un prodotto** nella pagina Immissione Polizza
2. Il sistema cerca nella tabella `matrice_provvigioni` se esiste una percentuale salvata per quel `prodotto_id`
3. **Se esiste** → pre-compila il campo provvigione con il valore salvato
4. **Se non esiste** → il campo resta vuoto, l'utente lo compila manualmente
5. Al salvataggio della polizza, un **dialog di conferma** chiede: "Vuoi salvare questa percentuale provvigionale come default per questo prodotto?"
   - Se conferma → upsert nella `matrice_provvigioni`
6. **Se l'utente modifica** una provvigione gia pre-compilata → un secondo dialog chiede: "La provvigione e diversa dal valore salvato (X%). Vuoi aggiornare il default per questo prodotto?"
   - Se conferma → update nella `matrice_provvigioni`
   - Se rifiuta → usa il valore solo per questa polizza, senza toccare il DB

### Interventi

**1. ImmissionePolizzaPage.tsx — Nuova sezione "Provvigioni"**

Aggiungere un fieldset "Provvigioni" tra "Importi" e "Tipo" con:
- Campo `% Provvigione Agenzia` (numerico)
- Badge indicatore: "Da database" (verde) oppure "Nuovo valore" (arancione)
- Il valore si auto-compila quando `selectedProdotto` cambia, cercando in `matrice_provvigioni`

**2. Query automatica provvigioni**

Nuova `useQuery` che si attiva al cambio di `selectedProdotto`:
```
SELECT * FROM matrice_provvigioni 
WHERE prodotto_id = :selectedProdotto AND attiva = true
ORDER BY user_id NULLS LAST, ufficio_id NULLS LAST
LIMIT 1
```
Se trova un record → setta il campo provvigione e segna `provvigioneFromDb = true`

**3. Dialog di conferma al salvataggio**

Alla pressione di "Conferma":
- Se `provvigioneFromDb === false` (valore nuovo, nessun record nel DB):
  - Dialog: "Non esiste una provvigione salvata per questo prodotto. Vuoi salvare X% come default?"
  - Si → INSERT in `matrice_provvigioni`
  - No → continua senza salvare il default
- Se `provvigioneFromDb === true` e il valore e stato modificato:
  - Dialog: "La provvigione e cambiata da Y% a X%. Vuoi aggiornare il default per questo prodotto?"
  - Si → UPDATE in `matrice_provvigioni`
  - No → usa il valore solo per questa polizza

**4. Nessuna modifica allo schema DB**

La tabella `matrice_provvigioni` ha gia tutti i campi necessari: `prodotto_id`, `percentuale_provvigione`, `tipo_calcolo`, `attiva`

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| File modificato | `src/pages/ImmissionePolizzaPage.tsx` |
| Tabella usata | `matrice_provvigioni` (gia esistente) |
| Nuovi state | `percentualeProvvigione`, `provvigioneFromDb`, `provvigioneOriginalValue` |
| Dialog | Componente `AlertDialog` gia presente nel progetto |
| Operazioni DB | SELECT al cambio prodotto, INSERT/UPDATE al salvataggio con conferma |

