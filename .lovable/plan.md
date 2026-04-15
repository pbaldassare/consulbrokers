

## Piano: Area Riservata Cliente con livelli di accesso e attivazione manuale

### Cosa cambia

1. **Nuova colonna `area_riservata_tipo` su `clienti`** — enum con valori: `nessuna` (default), `sola_lettura`, `completa`. Traccia se il cliente ha il portale attivo e di che tipo.

2. **Pulsante "Attiva Area Riservata" nel tab Anagrafica di ClienteDetail** — accanto ai dati del cliente, una card dedicata "Area Riservata" con:
   - Badge stato attuale (Nessuna / Sola Lettura / Completa)
   - Select per scegliere il tipo: Nessuna, Sola Lettura, Completa
   - Pulsante "Attiva / Aggiorna" che:
     - Se `user_id` mancante: chiama `create-cliente-user` per creare l'utente (email = username, password = Consul123!)
     - Salva il `area_riservata_tipo` scelto su `clienti`
   - Info: "Username: [email], Password di default: Consul123!"

3. **Aggiornamento Edge Function `create-cliente-user`** — password cambiata da `Leone123!` a `Consul123!`

4. **Portale Cliente (`ClienteLayout`) — controllo accesso per tipo**:
   - Se `area_riservata_tipo = 'sola_lettura'`: nascondere "Carica Doc" dalla sidebar; la pagina `/cliente/upload` mostra messaggio "Non autorizzato"
   - Se `area_riservata_tipo = 'completa'`: tutto visibile (upload + chat attiva)
   - Se `area_riservata_tipo = 'nessuna'`: il `ClienteGuard` blocca l'accesso

5. **Badge "Portale" nella lista clienti (`ClientiList`)** — nuova colonna "Portale" nella tabella con badge colorato:
   - Verde "Attivo" se `area_riservata_tipo` != `nessuna`
   - Grigio "—" se `nessuna`

6. **Badge nel header di ClienteDetail** — accanto al badge Attivo/Disattivo, mostrare badge portale (es. "Portale: Sola Lettura" arancione, "Portale: Completo" verde)

### Dettaglio tecnico

**Migrazione DB:**
```sql
ALTER TABLE clienti ADD COLUMN area_riservata_tipo text NOT NULL DEFAULT 'nessuna';
-- Per i clienti che hanno già user_id, impostare 'sola_lettura'
UPDATE clienti SET area_riservata_tipo = 'sola_lettura' WHERE user_id IS NOT NULL;
```

**File coinvolti:**
- **Migrazione SQL**: aggiungere colonna `area_riservata_tipo`
- **`supabase/functions/create-cliente-user/index.ts`**: password → `Consul123!`
- **`src/pages/ClienteDetail.tsx`**: card "Area Riservata" nel tab anagrafica con pulsante attivazione e select tipo
- **`src/pages/ClientiList.tsx`**: colonna + badge "Portale"
- **`src/components/ClienteLayout.tsx`**: filtrare `navItems` in base al tipo area riservata (query su `clienti.area_riservata_tipo`)
- **`src/components/ClienteGuard.tsx`**: verificare che `area_riservata_tipo != 'nessuna'` oltre al ruolo cliente
- **`src/pages/cliente/ClienteUploadDoc.tsx`**: check accesso completo

### Invio email di attivazione
Per ora il pulsante crea l'utente e mostra le credenziali. L'invio email di attivazione richiede un dominio email configurato — verrà aggiunto come step successivo se necessario.

