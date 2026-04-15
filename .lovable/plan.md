

## Piano: Spostare il "Riepilogo Messa a Cassa" nella pagina Contabilità — Incassi e Coperture

### Cosa cambia

La sezione "Riepilogo Messa a Cassa" (card con tabella espandibile per compagnia, con navigatore mese e pulsante Conferma) viene **rimossa** da `RimessaList.tsx` e **aggiunta** in `ContabilitaUfficio.tsx` (pagina `/contabilita`, voce sidebar "Incassi e Coperture").

### Dettaglio

**1. Spostare in `ContabilitaUfficio.tsx`:**
- Copiare le query: `rimessa-dettaglio-used` (titoli già collegati a rimesse) e `titoli-cassa-mese` (titoli incassati nel mese, raggruppati per compagnia)
- Copiare gli state: `meseCorrente`, `expanded`, `confirmDialog`, `dataPagamento`, `ibanSelezionato`
- Copiare la query `compagnia-iban` per il dialog conferma
- Copiare la `confirmMutation` (creazione rimessa) e la `revertMutation` (annullamento)
- Copiare il calcolo `totali` e le funzioni helper (`toggleExpand`, `clienteDisplay`, `openConfirm`)
- Aggiungere il navigatore mese (frecce + label mese) sopra la card
- Aggiungere la Card "Riepilogo Messa a Cassa" con tabella espandibile e pulsante Conferma per compagnia
- Aggiungere il Dialog di conferma rimessa (con IBAN, data pagamento)
- Aggiungere gli import necessari: `format`, `startOfMonth`, `endOfMonth`, `addMonths`, `subMonths`, `ChevronLeft`, `ChevronRight`, `Package`, `ChevronDown`, `ChevronUp`, `ExternalLink`, `Check`, `Send`, `useNavigate`

**2. Rimuovere da `RimessaList.tsx`:**
- Rimuovere la Card "Riepilogo Messa a Cassa" e tutto il codice collegato (query `titoli-cassa-mese`, `rimessa-dettaglio-used`, `compagnia-iban`, mutation `confirmMutation`, stati `expanded`, `confirmDialog`, `dataPagamento`, `ibanSelezionato`, calcolo `totali`, dialog conferma)
- Mantenere solo la sezione "Storico Rimesse" con la tabella paginata e il filtro stato

### File coinvolti
- **Modifica**: `src/pages/ContabilitaUfficio.tsx` — aggiungere riepilogo messa a cassa con tutte le funzionalità
- **Modifica**: `src/pages/RimessaList.tsx` — rimuovere la sezione riepilogo, tenere solo lo storico rimesse

