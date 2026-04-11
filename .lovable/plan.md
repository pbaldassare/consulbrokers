

## Piano: Migliorare la creazione Chat Contestuale

### Problemi attuali
1. La lista utenti mostra SOLO staff interno — i clienti (ruolo=cliente) non compaiono mai
2. Quando si collega a un cliente, non si aggiunge automaticamente l'utente-cliente come membro
3. La ricerca entita e' minimale: le polizze mostrano solo numero, le trattative solo titolo, senza contesto (nome cliente, compagnia, ecc.)
4. Non c'e' collegamento logico: se scelgo "Polizza", dovrebbe mostrarmi il cliente associato e aggiungerlo automaticamente
5. Manca la possibilita' di aggiungere clienti come partecipanti alla chat

### Modifiche

#### 1. `NuovaConversazioneDialog.tsx` — Riscrittura logica partecipanti e ricerca entita

**Partecipanti**:
- Aggiungere sezione "Clienti" oltre a "Staff" nella lista utenti
- Quando `visibileCliente=true`, caricare anche i profili con `ruolo=cliente` e mostrarli in una sezione separata con badge "Cliente"
- Filtro ruolo esteso: aggiungere opzione "Cliente" al dropdown ruoli

**Ricerca entita migliorata**:
- **Cliente**: mostra tipo (Privato/Azienda), email, telefono nella riga risultato
- **Polizza**: mostra `numero_titolo + nome cliente + compagnia + ramo` — query con join a `clienti` e `compagnie`
- **Trattativa**: mostra `titolo + stato + nome cliente/prospect` — query con join
- **Sinistro**: mostra `numero_sinistro + tipo + nome cliente + polizza collegata`

**Auto-collegamento**:
- Quando si seleziona un'entita (cliente/polizza/sinistro/trattativa), trovare automaticamente l'utente-cliente associato (tramite `clienti.user_id` o lookup `profiles` con `ruolo=cliente`) e pre-selezionarlo nella lista partecipanti
- Il cliente viene aggiunto come membro con `ruolo_canale=membro`

**Nome canale auto-generato**:
- Se non specificato, generare automaticamente: es. "Polizza #12345 - Rossi Mario" o "Sinistro #SIN-001 - Bianchi"

#### 2. `CanaliSidebar.tsx` — Mostrare info entita nei canali contestuali

- Per i canali contestuali, mostrare il nome dell'entita collegata (non solo il tipo)
- Query aggiuntiva per risolvere `entita_id` -> nome leggibile (cliente nome, numero polizza, ecc.)

#### 3. `ChatTab.tsx` — Auto-aggiungere il cliente come membro

- Quando crea un canale contestuale da una scheda entita, cercare l'utente-cliente associato e aggiungerlo automaticamente come membro
- Per polizze: lookup `titoli.cliente_anagrafica_id` -> `clienti.id` -> `profiles` con match email
- Per sinistri: lookup `sinistri.cliente_anagrafica_id` -> stessa logica

### File coinvolti

| File | Azione |
|------|--------|
| `src/components/chat/NuovaConversazioneDialog.tsx` | Riscrittura: ricerca entita con join, lista utenti con clienti, auto-collegamento, nome auto |
| `src/components/chat/CanaliSidebar.tsx` | Migliorare display nome canale contestuale con info entita |
| `src/components/ChatTab.tsx` | Auto-aggiungere cliente come membro alla creazione canale |

### Dettagli tecnici
- Query entita con join: `titoli` -> `clienti` + `compagnie` + `rami` per mostrare contesto completo
- Ricerca clienti-utente: `profiles` con `ruolo=cliente` per la lista partecipanti
- Lookup cliente associato: tramite `clienti` -> match con `profiles` (stessa email o campo dedicato)
- Nessuna modifica database, solo miglioramenti frontend

