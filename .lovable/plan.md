

## Piano: Collegare Produttori agli Uffici

### Situazione attuale
- La tabella `anagrafiche_professionali` ha gia il campo `ufficio_id` ma viene assegnato automaticamente dall'utente loggato (`profile?.ufficio_id`) senza possibilita di sceglierlo
- La pagina `GestioneUfficiPage` mostra le anagrafiche collegate ma non ha un tab dedicato ai "Produttori" (AE + Corrispondenti)
- La pagina `AnagraficheProfessionaliPage` non mostra un selettore ufficio nel form di creazione

### Cosa faremo

#### 1. Aggiungere selettore Ufficio nel form AnagraficheProfessionali
Nel dialog di creazione anagrafica, aggiungere un campo `Select` "Ufficio" obbligatorio per i tipi `account_executive` e `corrispondente`. L'admin potra scegliere qualsiasi ufficio; gli utenti ufficio vedranno solo il proprio (preselezionato).

#### 2. Aggiungere tab "Produttori" in GestioneUfficiPage
Nel dettaglio ufficio, aggiungere un quarto tab "Produttori" che mostra le anagrafiche di tipo `account_executive` e `corrispondente` collegate a quell'ufficio, con possibilita di:
- Vedere codice, nome, tipo, sigla, email
- Riassegnare un produttore a un altro ufficio (select inline)

#### 3. Aggiornare i conteggi nella lista uffici
Aggiungere una colonna "N. Produttori" nella tabella principale degli uffici, contando le anagrafiche di tipo AE + corrispondente.

### Dettagli tecnici

| Azione | File |
|--------|------|
| Modificare | `src/pages/AnagraficheProfessionaliPage.tsx` — aggiungere Select ufficio nel form, rendere obbligatorio per AE/corrispondente |
| Modificare | `src/pages/GestioneUfficiPage.tsx` — tab Produttori nel dettaglio, colonna N. Produttori nella lista, riassegnazione ufficio |

Nessuna migration necessaria — `ufficio_id` esiste gia in `anagrafiche_professionali`.

