

## Piano: Ufficio obbligatorio + Quote Provvigione per ruoli commerciali

### Cosa cambia

1. **Nuova colonna DB**: Aggiungere `percentuale_consulenza` (numeric) alla tabella `anagrafiche_professionali` per la quota provvigione consulenza, accanto alla `percentuale_base` gia esistente (quota provvigione standard).

2. **Nuovi tipi anagrafica**: Aggiungere `executive`, `responsabile_sede`, `produttore_sede` al trigger di validazione `validate_anagrafiche_professionali_tipo`, cosi da poter creare questi ruoli commerciali nel sistema.

3. **Ufficio obbligatorio per TUTTI i ruoli commerciali**: Nella UI, rendere il select Ufficio visibile e obbligatorio per tutti i tipi commerciali (executive, responsabile_sede, produttore_sede, account_executive, corrispondente). La lista uffici viene gia caricata dal DB (`uffici` table).

4. **UI Form aggiornato**: Per tutti i ruoli commerciali mostrare nel tab "Provvigioni":
   - % Provvigione (usa `percentuale_base`)
   - % Provvigione Consulenza (usa nuova `percentuale_consulenza`)
   - % Ritenuta Acconto (usa `percentuale_ra`)

### Modifiche per file

| File | Modifica |
|------|----------|
| **Migration SQL** | `ALTER TABLE anagrafiche_professionali ADD COLUMN percentuale_consulenza numeric(5,2) DEFAULT 0;` + aggiornare trigger validazione tipi |
| **AnagraficheProfessionaliPage.tsx** | Aggiungere 3 nuovi tab (Executive, Resp. Sede, Prod. Sede) al TIPI array. Estendere `isProduttore` a tutti i 5 ruoli commerciali. Aggiungere campo `percentuale_consulenza` al form e al payload insert. Mostrare tab Provvigioni con i 3 campi per tutti i ruoli commerciali |

### Dettagli tecnici

- La tabella `uffici` esiste gia con dati — nessuna modifica necessaria
- `percentuale_base` = quota provvigione produzione
- `percentuale_consulenza` = quota provvigione consulenza (nuova)
- `percentuale_ra` = ritenuta d'acconto (gia esistente)
- Validazione frontend: ufficio_id required per tutti i tipi commerciali prima del submit

