

## Piano: Collegare Primanota → Scadenziario (creazione automatica scadenze)

### Cosa cambia

#### 1. Primanota: aggiungere checkbox e campo data scadenza nel dialog di creazione
Nel dialog "Nuova Registrazione Primanota", aggiungere:
- Checkbox **"Genera scadenza"** (default: on)
- Campo **"Data scadenza"** (default: +30 giorni dalla data PN)
- Campo **"Giorni scadenza"** (30/60/90/120 — shortcut che calcola la data)

Quando si salva con "Genera scadenza" attivo, dopo l'insert nella `primanota_generale`, inserire automaticamente un record nella tabella `scadenziario` con:
- `fornitore_id` dalla primanota
- `primanota_id` = id appena creato
- `importo` = totale della primanota (al netto della ritenuta)
- `data_scadenza` = data scadenza indicata
- `descrizione` = "PN {numero_pn} — {descrizione}"
- `stato` = "aperta"
- `ufficio_id` dal profilo utente

#### 2. Primanota: bottone "Crea Scadenza" per righe esistenti
Nella tabella primanota, aggiungere un'azione per riga (icona CalendarPlus) che apre un mini-dialog per creare una scadenza da quella registrazione, con importo e fornitore pre-compilati.

#### 3. Scadenziario: mostrare collegamento alla primanota
Nella tabella scadenziario, aggiungere colonna **"N° PN"** che mostra il numero primanota collegato (se presente), con link/badge.

### File coinvolti

| Azione | File |
|--------|------|
| Modificare | `src/pages/contGenerale/PrimanotaGeneralePage.tsx` — checkbox scadenza nel dialog + bottone riga |
| Modificare | `src/pages/contGenerale/ScadenziarioPage.tsx` — colonna N° PN con join primanota |

Nessuna migration necessaria — `scadenziario.primanota_id` esiste già come FK.

