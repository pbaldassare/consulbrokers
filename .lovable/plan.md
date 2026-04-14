

## Piano: Implementare Sospensione e Riattivazione polizze

### Situazione attuale
- **`handleConferma`** in `SospensionePolizzaPage.tsx` e `RiattivazionePolizzaPage.tsx` sono entrambi **TODO vuoti** — non salvano nulla in database.
- La tabella `titoli` ha il campo `stato` (vincolo: 'attivo','sospeso','scaduto','incassato') ma **non ha** `data_sospensione` ne `limite_riattivazione`.
- Le polizze sospese sono già visibili in **Portafoglio Storico** (`PortafoglioStoricoPage.tsx`), che filtra per `stato IN (scaduto, sospeso)`.

### Interventi

**1. Migrazione database — aggiungere campi sospensione su `titoli`**
```sql
ALTER TABLE titoli ADD COLUMN data_sospensione date;
ALTER TABLE titoli ADD COLUMN limite_riattivazione date;
ALTER TABLE titoli ADD COLUMN data_riattivazione date;
ALTER TABLE titoli ADD COLUMN motivo_sospensione text;
```

**2. Implementare `handleConferma` in `SospensionePolizzaPage.tsx`**
- Validare campi obbligatori (polizza, data sospensione)
- Trovare il titolo tramite `numero_titolo` (o `id` se `paramTitoloId` presente)
- Aggiornare `titoli` con: `stato = 'sospeso'`, `data_sospensione`, `limite_riattivazione`, `motivo_sospensione`
- Creare un movimento in `movimenti_polizza` di tipo "SO" (sospensione) per tracciamento storico
- Log attività + toast di conferma
- Redirect al dettaglio titolo

**3. Implementare `handleConferma` in `RiattivazionePolizzaPage.tsx`**
- Validare campi obbligatori (polizza da riattivare, data riattivazione)
- Aggiornare il titolo sospeso: `stato = 'attivo'`, `data_riattivazione`
- Creare un movimento in `movimenti_polizza` di tipo "RA" (riattivazione)
- Log attività + toast + redirect

**4. Visualizzare i sospesi — il flusso esiste già**
- **Portafoglio Storico** (`/portafoglio/storico`) mostra già le polizze sospese con filtro per stato
- Aggiungere nel filtro stato un'opzione esplicita "Sospeso" per filtrare solo i sospesi
- Nella tabella storico, mostrare `data_sospensione` e `limite_riattivazione` come colonne aggiuntive
- Nella riga della polizza sospesa, aggiungere un pulsante diretto "Riattiva" che naviga a `/portafoglio/riattivazione?polizza=...&titoloId=...`

### File coinvolti
- **Migrazione SQL** — nuovi campi su `titoli`
- `src/pages/SospensionePolizzaPage.tsx` — logica salvataggio
- `src/pages/RiattivazionePolizzaPage.tsx` — logica salvataggio
- `src/pages/PortafoglioStoricoPage.tsx` — colonne extra + pulsante Riattiva

### Riepilogo flusso utente
1. Da dettaglio polizza → click "Sospensione" → compila data e limite → Conferma → polizza diventa "sospeso"
2. Vai a Portafoglio Storico → filtra per "Sospeso" → vedi tutte le sospese con date e limite
3. Click "Riattiva" sulla riga → si apre pagina riattivazione precompilata → Conferma → polizza torna "attivo"

