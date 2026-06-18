## Stato attuale

Già fatto nell'iterazione precedente:
- Header del titolo RG con badge "Regolazione" + link alla quietanza madre (`TitoloHeaderBar.tsx`)
- Toolbar Operazioni ridotta (solo Messa a Cassa, Storno, Annullamento) + banner informativo (`TitoloDetail.tsx`)
- Pannello "Regolazioni collegate" nel dettaglio del titolo madre (`TitoloDetail.tsx`)

## Cosa manca

### 1. Nidificazione nelle liste di portafoglio
Le RG oggi compaiono ancora come righe di primo livello in:
- `src/pages/PortafoglioAttivePage.tsx`
- `src/pages/PortafoglioCaricoPage.tsx`
- `src/pages/PortafoglioStoricoPage.tsx`
- `src/pages/GestionePolizzePage.tsx`

Devono diventare figlie espandibili della quietanza di riferimento (`regolazione_quietanza_id`), con `pl-8` + icona `CornerDownRight` e badge arancione "Regolazione".

**Nota tecnica**: la view `v_portafoglio_titoli` usata da queste pagine non espone `is_regolazione` e `regolazione_quietanza_id`. Serve una migrazione che aggiunga queste due colonne alla view (nessun cambio dati, solo `CREATE OR REPLACE VIEW`).

### 2. Filtro "Tipo" e badge in tabella
- Aggiungere opzione **Regolazione** nel filtro Tipo (oggi Polizza/Quietanza basato su `sostituisce_polizza`)
- Sostituire il badge Polizza/Quietanza con badge arancione "Regolazione" sulle righe RG

### 3. Testo esplicativo nel dialog Regolazione
In `src/components/polizze/azioni/AppendiceDialog.tsx`, aggiungere una nota nel `SearchableSelect` quietanze per il caso "polizza unica senza rate" (la RG si aggancia alla rata 1 che coincide con la madre). Nessuna logica cambia.

### 4. Verifica manuale
- Creare RG su Rata 1 di una polizza → deve apparire nidificata sotto Rata 1 in Gestione/Carico/Attive/Storico
- Filtro Tipo=Regolazione mostra solo le RG
- Messa a Cassa della RG resta indipendente dalla rata madre

## Fuori scope (come da plan originale)
- Stampe/export con struttura nidificata
- Permessi differenziati per RG
- Opzione utente per agganciare la RG alla polizza invece che alla quietanza
