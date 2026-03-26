

## Piano: Collegamento obbligatorio Polizze-Clienti

### Problema

I titoli (polizze) nel database non hanno tutti il campo `cliente_anagrafica_id` valorizzato. I clienti visibili nella lista mostrano "0" polizze perche le polizze seed non sono collegate a quei clienti specifici. Inoltre, il campo `cliente_anagrafica_id` e nullable, quindi si possono creare polizze senza cliente.

### Interventi

**1. Migration: rendere `cliente_anagrafica_id` obbligatorio**
- Aggiornare i titoli esistenti senza `cliente_anagrafica_id`: assegnarli a un cliente di default oppure eliminarli
- Alterare la colonna `cliente_anagrafica_id` impostando `NOT NULL`
- Questo garantisce che ogni polizza futura abbia sempre un cliente collegato

**2. Migration: aggiornare i dati seed esistenti**
- Scrivere un UPDATE che assegna un `cliente_anagrafica_id` valido a tutti i titoli che ne sono privi, distribuendoli tra i clienti esistenti nella tabella `clienti`

**3. Pagina ImmissionePolizzaPage e altri form**
- Verificare che il campo cliente sia obbligatorio nei form di creazione/modifica polizza
- Se manca la validazione, aggiungerla

**4. Query conteggio polizze (gia funzionante)**
- La query in `ClientiList.tsx` funziona gia correttamente; una volta che i dati sono linkati, i conteggi si aggiorneranno automaticamente

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| File creato | Nuova migration SQL |
| File verificati | `src/pages/ImmissionePolizzaPage.tsx`, `src/pages/TitoliList.tsx` |
| Impatto | Tutti i titoli avranno un cliente, la colonna Polizze mostrera valori corretti |

