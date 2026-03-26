

## Piano: Rimuovere pagina Causali/Tabelle di Servizio

La tabella `causali_contabili` resta nel database perche e usata come FK dalla Primanota Generale (campo `causale_id`). Si rimuove solo la pagina di gestione dedicata e la voce nel menu.

### Modifiche

| File | Azione |
|---|---|
| `src/pages/contGenerale/CausaliPage.tsx` | Eliminare il file |
| `src/components/AppSidebar.tsx` | Rimuovere la voce "Causali/Tabelle" dal menu Cont. Generale |
| `src/routes/contabilita.tsx` | Rimuovere la rotta `/cont-generale/causali` e il relativo import |

La tabella DB `causali_contabili` e i dati seed restano invariati: servono come lookup per la Primanota Generale (dropdown causale nel form di registrazione).

