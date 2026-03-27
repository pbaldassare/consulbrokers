

## Piano: Semplificare la lista Clienti

### Situazione attuale
- La lista ha 3 tab separati (Privati / Aziende / Enti) con tabelle diverse per ciascuno
- Il sorting ha "Cognome A-Z" che non ha senso per aziende/enti
- La ricerca è limitata al tab attivo
- Il `codice_ricerca` dall'Excel **e stato importato** correttamente nel DB

### Modifiche

**1. Rimuovere i tab Privati/Aziende/Enti**
- Eliminare il componente `Tabs` con i 3 `TabsContent`
- Mostrare una singola tabella unificata per tutti i clienti

**2. Tabella unificata con colonne adattive**
- Colonne: **Codice** | **Denominazione** | **CF / P.IVA** | **Email** | **Telefono** | **Citta** | **Stato** | **Attivo**
- La colonna "Denominazione" mostra `cognome nome` per privati, `ragione_sociale` per aziende/enti
- La colonna "CF / P.IVA" mostra `codice_fiscale` per privati, `partita_iva` per aziende

**3. Sostituire il sorting "Cognome A-Z"**
- Cambiare in "Nome A-Z" / "Data creazione ↓"
- L'ordinamento "Nome A-Z" ordina per `cognome` (privati) e `ragione_sociale` (aziende) — usare una colonna calcolata o ordinare lato client, oppure usare `.order()` su entrambi i campi

**4. Potenziare la ricerca**
- Ricerca su TUTTI i campi rilevanti in un'unica query senza filtro `tipo_cliente`:
  `nome, cognome, ragione_sociale, codice_fiscale, codice_fiscale_azienda, partita_iva, email, pec, telefono, citta_residenza, citta_sede, codice_ricerca`
- La query non filtrerà più per `tipo_cliente`

**5. Aggiornare la query**
- Rimuovere `.eq("tipo_cliente", tipoTab)`
- Rimuovere lo state `tipoTab`
- Unificare il filtro di ricerca `or()` per coprire tutti i campi

### File modificato
- `src/pages/ClientiList.tsx` — rimuovere tabs, unificare tabella e ricerca

### Il dialog "Nuovo Cliente" resta invariato
Il form di creazione mantiene la selezione del tipo cliente (privato/azienda/ente) poiche determina quali campi compilare.

