

## Piano: Rinominare "Uffici" in "Sedi" + aggiungere campi contatto

### Interventi

**1. Migration SQL**
- Aggiungere colonne alla tabella `uffici`: `indirizzo text`, `email text`, `telefono text` (tutti nullable)
- Popolare i record esistenti con dati fake realistici (indirizzi italiani, email tipo sede-xxx@consulnet.it, numeri fissi)
- Rinominare `codice_ufficio` → `codice_sede` e `nome_ufficio` → `nome_sede` a livello di alias/display (la tabella DB resta `uffici` per non rompere tutte le FK)

**2. GestioneUfficiPage.tsx — Aggiornamento completo**
- Rinominare tutti i testi: "Ufficio" → "Sede", "Uffici" → "Sedi" (titoli, label, placeholder, toast, card)
- Aggiungere al form di creazione/modifica i 3 nuovi campi: Indirizzo, Email, Telefono (non obbligatori)
- Mostrare i nuovi campi nella tabella elenco (colonne aggiuntive)
- Aggiornare l'interfaccia Ufficio per includere i nuovi campi

**3. AppSidebar.tsx — Rinominare voce menu**
- "Gestione Uffici" → "Gestione Sedi"

**4. Route — Aggiornare path (opzionale)**
- Mantenere `/gestione-uffici` come path per non rompere bookmark, ma aggiornare il label nel menu

**5. Altri file — Rinominare label visibili**
- Nei ~50 file che mostrano "Ufficio" come label nei filtri/select, rinominare in "Sede"
- File principali: `NuovaConversazioneDialog.tsx`, `ECClientiContabPage.tsx`, filtri vari, `ProspectList.tsx`, ecc.
- Il campo DB `ufficio_id` e la tabella `uffici` restano invariati per evitare migration distruttive

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| Migration | `ALTER TABLE uffici ADD COLUMN indirizzo text, ADD COLUMN email text, ADD COLUMN telefono text` + UPDATE con dati fake |
| Tabella DB | Resta `uffici` (rename solo UI) |
| File principale | `GestioneUfficiPage.tsx` |
| File con label da aggiornare | ~15-20 file con testo "Ufficio/Uffici" visibile all'utente |
| Campi nuovi nel form | Indirizzo, Email, Telefono — tutti opzionali |

