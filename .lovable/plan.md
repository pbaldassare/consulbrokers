

## Piano: Aggiungere modifica (edit) per tutte le anagrafiche professionali

### Problema
Attualmente la pagina permette solo la creazione (+ Nuovo) e il toggle attivo/annullato. Manca la possibilità di modificare un record esistente.

### Modifiche in `src/pages/AnagraficheProfessionaliPage.tsx`

1. **Stato `editingId`**: Aggiungere `const [editingId, setEditingId] = useState<string | null>(null)` per distinguere creazione da modifica

2. **Click sulla riga per aprire modifica**: Aggiungere `onClick` su ogni `TableRow` che popola il form con i dati del record e apre il dialog in modalità edit

3. **Funzione `openEdit(item)`**: Popola il `form` con tutti i campi dell'anagrafica selezionata, setta `editingId = item.id`, apre il dialog

4. **Mutation di update**: Aggiungere `updateMutation` che esegue `supabase.from("anagrafiche_professionali").update({...}).eq("id", editingId)` con lo stesso payload della create

5. **Dialog adattivo**: Il titolo diventa "Modifica {tipo}" quando `editingId` è valorizzato, "Nuovo {tipo}" altrimenti. Il submit chiama `updateMutation` o `createMutation` in base a `editingId`

6. **Reset**: Al close del dialog, resettare sia `form` che `editingId`

7. **Cursor pointer sulle righe**: Aggiungere `className="cursor-pointer hover:bg-muted/50"` alle TableRow

### File coinvolto

| File | Azione |
|------|--------|
| `src/pages/AnagraficheProfessionaliPage.tsx` | Aggiungere stato editingId, openEdit(), updateMutation, click su riga, dialog adattivo crea/modifica |

