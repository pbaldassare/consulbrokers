

## Piano: Creare utenza per segreteria@consulbrokers.it

### Dettagli account
- **Email**: segreteria@consulbrokers.it
- **Password**: Leone123!
- **Nome**: Segreteria
- **Cognome**: Consulbrokers
- **Ruolo**: `ufficio` (Sede — Ufficio di Napoli)
- **Ufficio**: Ufficio di Napoli

### Permessi JSON
Solo le sezioni richieste saranno abilitate:

```json
{
  "dashboard": true,
  "titoli": true,
  "portafoglio": true,
  "contabilita": true
}
```

Mappatura permessi → sezioni sidebar:
- `dashboard` → Home, Anagrafiche Utenti, Chat, Bandi, Notifiche
- `titoli` → Portafoglio (Clienti, Polizze, Carico, Storico, Attive, ecc.) + Trattative
- `portafoglio` → Archivio Documentale
- `contabilita` → Contabilità (Cruscotto, Distinta, EC, Quadrature, ecc.)

**Non abilitati**: sinistri, cfo_area, impostazioni (Sistema), provvigioni

### Azione
Invocare la Edge Function `create-user` con i dati sopra per creare l'utente in auth + profilo + ruolo.

### File coinvolti
Nessuna modifica al codice — operazione via Edge Function esistente.

