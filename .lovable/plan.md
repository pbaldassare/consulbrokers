

## Piano: Workflow Bandi Pubblici - Crea Trattativa e Auto-Prospect

### Cosa cambia

1. **Counter chiamate API**: mostrare un contatore delle chiamate API effettuate nella sessione (es. "3 chiamate API") accanto al pulsante Cerca Bandi

2. **Auto-salvataggio Prospect dall'ente**: quando arrivano i risultati, per ogni bando l'ente (es. "ISTITUTO COMPRENSIVO - MONDOVI' I") viene salvato come prospect in anagrafica automaticamente (upsert per ragione_sociale), con `fonte = "API Mondoappalti"` e `tipo_cliente = "ente"`

3. **Pulsante "Crea Trattativa" al posto di "Collega trattativa"**: il dialog attuale diventa un form di creazione trattativa (non piu' selezione da lista esistente). Campi pre-compilati dal bando:
   - `prospect_id` = il prospect auto-creato dall'ente
   - `prodotto` = keyword usata (es. "Brokeraggio assicurativo")
   - `data_scadenza` = scadenza del bando
   - `premio_previsto` = importo del bando
   - `note` = titolo completo del bando + CIG + link
   - `stato` = "aperta"
   - Popup di conferma prima del salvataggio

4. **Colonna `fonte` nella tabella `trattative`**: migrazione DB per aggiungere `fonte TEXT` alla tabella trattative. Valorizzato con "API Mondoappalti" quando creata da bando

5. **Keyword visibile su ogni card**: mostrare un badge con la keyword di ricerca collegata (es. "Brokeraggio assicurativo") su ogni card bando. Salvare la keyword nel campo `tipologia` o in un nuovo campo `keyword` nella tabella `bandi_pubblici`

6. **Collegamento bando-trattativa**: dopo la creazione, inserire il record in `bandi_trattative` per mantenere il link

### Migrazione DB

```sql
-- Aggiungere fonte alle trattative
ALTER TABLE trattative ADD COLUMN IF NOT EXISTS fonte TEXT;

-- Aggiungere keyword ai bandi_pubblici (per tracciare la keyword usata)
ALTER TABLE bandi_pubblici ADD COLUMN IF NOT EXISTS keyword TEXT;
```

### File coinvolti

| File | Azione |
|------|--------|
| Migrazione SQL | Aggiungere `fonte` a trattative, `keyword` a bandi_pubblici |
| `src/pages/BandiPubbliciPage.tsx` | Counter API, auto-prospect, dialog "Crea Trattativa", badge keyword, conferma salvataggio |

### Flusso utente

1. Utente cerca bandi → counter mostra "1 chiamata API"
2. Arrivano risultati → per ogni ente viene creato/aggiornato un prospect automaticamente
3. Su ogni card bando appare il badge "Brokeraggio assicurativo"
4. Utente clicca "Crea Trattativa" → dialog con dati pre-compilati dal bando
5. Utente conferma → trattativa salvata in DB con `fonte = "API Mondoappalti"`, collegata al bando e al prospect
6. La trattativa appare nella lista trattative con la fonte indicata

