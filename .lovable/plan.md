

## Piano: Collegare Rimessa Premi a E/C Compagnia e Incassi e Coperture

### Situazione attuale
- **Rimessa Premi** (`/rimessa-premi`) è una pagina separata nel menu sotto "Portafoglio" che mostra lo storico delle rimesse create
- **E/C Compagnia** (`/contabilita/ec-compagnia`) mostra un estratto conto per compagnia basato sui titoli
- **Incassi e Coperture** (`/contabilita`) è dove si creano le rimesse (conferma rimessa per compagnia)

Il problema: "Rimessa Premi" duplica concettualmente l'E/C Compagnia e dovrebbe essere accessibile da Incassi e Coperture, non come pagina separata nel Portafoglio.

### Cosa cambia

**1. Rimuovere "Rimessa Premi" dalla sidebar Portafoglio**
- Togliere la voce `{ label: "Rimessa Premi", path: "/rimessa-premi", icon: Send }` dalla sezione Portafoglio in `AppSidebar.tsx`

**2. Integrare lo storico rimesse nella pagina E/C Compagnia**
- Aggiungere un tab o una sezione "Storico Rimesse" nella pagina `ECCompagniaContabPage.tsx` che mostri la tabella delle rimesse (compagnia, sede, importo, IBAN, data pagamento, stato) — la stessa logica attuale di `RimessaList.tsx`
- In questo modo E/C Compagnia diventa il punto unico per vedere sia l'estratto conto sia le rimesse effettuate

**3. Aggiungere link "Storico Rimesse" da Incassi e Coperture**
- In `ContabilitaUfficio.tsx`, dopo la conferma rimessa, aggiungere un pulsante/link "Vedi Storico Rimesse" che porta a `/contabilita/ec-compagnia` (tab rimesse)
- Oppure aggiungere un collegamento diretto nella parte superiore della pagina

**4. Mantenere le route esistenti**
- Le route `/rimessa-premi` e `/rimessa-premi/:id` restano funzionanti (per link diretti e notifiche) ma non compaiono più nella sidebar

### File coinvolti
- **`src/components/AppSidebar.tsx`** — rimuovere voce "Rimessa Premi" dal menu Portafoglio
- **`src/pages/contabilita/ECCompagniaContabPage.tsx`** — aggiungere tab "Storico Rimesse" con la tabella delle rimesse
- **`src/pages/ContabilitaUfficio.tsx`** — aggiungere link a E/C Compagnia / Storico Rimesse

