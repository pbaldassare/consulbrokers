

## Piano: Aggiungere tab "Enti" nella lista Clienti

### Problema
La lista clienti ha solo due tab (Privati, Aziende) ma il sistema supporta anche il tipo "ente". I clienti di tipo ente non sono visibili in nessuna tab.

### Intervento

**File: `src/pages/ClientiList.tsx`**

1. **Aggiungere la terza tab "Enti"** nella `TabsList` dopo "Aziende", con icona `Landmark` (lucide-react)
2. **Aggiornare il filtro `filtered`** — il tipo "ente" usa gli stessi campi di ricerca delle aziende (ragione_sociale, partita_iva, codice_fiscale_azienda, email, pec)
3. **Aggiungere `TabsContent` per "ente"** — stessa struttura tabellare delle aziende (Ragione Sociale, P.IVA, SDI, Email, PEC) dato che gli enti hanno campi analoghi
4. **Aggiornare il `Select` tipo cliente nel dialog di creazione** — aggiungere opzione "Ente" (il tipo union diventa `"privato" | "azienda" | "ente"`)
5. **Aggiornare il sottotitolo pagina** — "Anagrafica clienti privati, aziende ed enti"

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| File modificato | `src/pages/ClientiList.tsx` |
| Icona ente | `Landmark` da lucide-react |
| Campi tabella ente | Ragione Sociale, P.IVA, Codice SDI, Email, PEC (come aziende) |
| Tipo state | `tipoCliente` union esteso a includere `"ente"` |

