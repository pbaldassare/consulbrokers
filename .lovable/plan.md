

## Piano: Unificare la selezione entita nella Nuova Chat Contestuale

### Problema
Il dialog attuale ha tab separate "Cliente" e "Polizza" come tipi entita distinti nel dropdown, ma in realta polizza e cliente sono collegati. L'utente deve poter cercare in modo unificato e fluido. Mancano anche prospect e trattative come entita ben collegate.

### Soluzione
Riscrivere la sezione "Collega a entita" del `NuovaConversazioneDialog.tsx` con un'unica interfaccia di ricerca unificata:

#### 1. Ricerca unificata con tab per tipo
Sostituire il dropdown entita + campo ricerca con **tab orizzontali** (Clienti/Prospect, Polizze, Trattative, Sinistri, Argomento libero). Ogni tab mostra risultati con contesto completo:

- **Clienti/Prospect** (tab unica): cerca sia in `clienti` che in `prospect` contemporaneamente, mostrando badge "Cliente" o "Prospect" per distinguerli. Mostra tipo, email, telefono.
- **Polizze**: cerca per numero titolo O per nome cliente. Mostra `numero_titolo + cliente + compagnia + stato`. Cliccando una polizza, si seleziona automaticamente anche il cliente collegato.
- **Trattative**: cerca per prodotto O nome cliente/prospect. Mostra `prodotto + cliente/prospect + stato + compagnia`.
- **Sinistri**: cerca per numero sinistro O nome cliente. Mostra `numero + tipo + cliente + stato`.

#### 2. Selezione a cascata intelligente
Quando si seleziona una **polizza**:
- Auto-compila il cliente collegato (visibile come chip)
- Chiama `findAllRelatedUsers` per pre-selezionare tutti i collegati

Quando si seleziona un **cliente/prospect**:
- Mostra le sue polizze/trattative attive come sotto-selezione opzionale
- Chiama `findAllRelatedUsers` per il cliente

Quando si seleziona una **trattativa**:
- Auto-compila il cliente o prospect collegato
- `findAllRelatedUsers` include assegnato_a, ufficio, commerciali

#### 3. Riepilogo partecipanti unificato
Eliminare le tab Staff/Clienti separate. Mostrare una **lista unica** di partecipanti auto-collegati raggruppati per ruolo (badge colorati: Cliente, Produttore, Staff, Commerciale, Corrispondente). L'utente puo' aggiungere/rimuovere manualmente con un campo "Aggiungi partecipante" che cerca in tutti i profiles.

#### 4. Estendere `findRelatedUsers.ts` per prospect
Aggiungere `resolveProspect` alla funzione esistente:
- `prospect.user_id` (se esiste)
- `prospect.assegnato_a`
- `prospect.ufficio_id` → staff ufficio
- Trattative collegate al prospect → `assegnato_a`

### File coinvolti

| File | Azione |
|------|--------|
| `src/components/chat/NuovaConversazioneDialog.tsx` | Riscrittura: tab unificate, ricerca cross-entita, selezione a cascata, lista partecipanti unificata |
| `src/lib/findRelatedUsers.ts` | Aggiungere `resolveProspect` per prospect con assegnato_a e ufficio |

### Nessuna modifica database
Tutte le relazioni necessarie esistono gia nelle tabelle.

