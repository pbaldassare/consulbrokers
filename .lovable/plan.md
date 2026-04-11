

## Piano: Ristrutturazione Chat a due livelli

### Situazione attuale
- **Chat interna** (`/comunicazioni`): usa `chat_canali` + `chat_messaggi_interni` -- solo staff interno
- **Chat contestuale** (`ChatTab`): usa `chat_messaggi` -- legata a entita (cliente, sinistro, titolo, prospect)
- **Chat cliente** (`/cliente/comunicazioni`): placeholder vuoto, non funzionante
- Le due chat sono completamente separate e non collegate

### Obiettivo
Unificare il sistema in una Chat a due livelli:
1. **Chat Interna** (solo organizzazione) -- resta come oggi ma rinominata "Chat" nella sidebar
2. **Chat Contestuale** (con clienti) -- collegata a trattativa, polizza, cliente, sinistro o argomento libero. Visibile anche dal portale cliente

### Modifiche

#### 1. Database -- Estendere `chat_canali` per supportare contesto
Aggiungere colonne alla tabella `chat_canali`:
- `ambito` (text, default 'interno') -- `interno` o `contestuale`
- `entita_tipo` (text, nullable) -- `cliente`, `trattativa`, `titolo`, `sinistro`, `argomento`
- `entita_id` (text, nullable) -- UUID dell'entita collegata
- `visibile_cliente` (boolean, default false) -- se il cliente puo vedere/scrivere

Questo permette di usare un unico sistema di canali per entrambi i livelli.

#### 2. Unificare i messaggi -- Migrare `ChatTab` a usare `chat_canali`
Il `ChatTab` attualmente usa `chat_messaggi` (tabella separata). Lo modificheremo per:
- Quando si apre una chat contestuale su un'entita, cercare/creare automaticamente un canale con `ambito='contestuale'` + `entita_tipo` + `entita_id`
- Usare `chat_messaggi_interni` per i messaggi (un'unica tabella)
- Loggare ogni messaggio con `logAttivita` come gia fa

#### 3. Pagina Chat (`/chat`) -- Rinominare e aggiungere tab ambito
- Rinominare rotta da `/comunicazioni` a `/chat`
- Aggiungere toggle "Interna" / "Contestuale" nella sidebar canali
- In modalita Contestuale mostrare i canali legati a entita con badge tipo (Polizza, Cliente, Trattativa...)
- "Nuova conversazione contestuale" permette di scegliere: entita da collegare + partecipanti

#### 4. Portale Cliente -- Attivare la chat
`ClienteComunicazioni` diventa una vera chat:
- Carica i canali dove `visibile_cliente = true` e il cliente e membro
- Usa gli stessi componenti `ChatArea` gia esistenti
- Il cliente vede solo i canali contestuali a lui collegati
- Rinominare in "Chat" anche nel layout cliente

#### 5. Sidebar e routing
- Sidebar: "Comunicazioni" diventa "Chat" con icona `MessageSquare`
- Rotta: `/comunicazioni` → `/chat` (con redirect per compatibilita)
- Layout cliente: "Comunicazioni" → "Chat"

#### 6. RLS -- Policy per ambito
- I canali `interno` restano visibili solo a ruoli interni (come oggi)
- I canali `contestuale` con `visibile_cliente = true` sono visibili anche al ruolo `cliente` se membro

### File coinvolti

| File | Azione |
|------|--------|
| Nuova migrazione SQL | ALTER TABLE `chat_canali` ADD ambito, entita_tipo, entita_id, visibile_cliente + RLS |
| `src/components/chat/CanaliSidebar.tsx` | Tab Interna/Contestuale + badge entita |
| `src/components/chat/NuovaConversazioneDialog.tsx` | Opzione per creare chat contestuale con selezione entita |
| `src/components/ChatTab.tsx` | Riscrittura: crea/cerca canale contestuale, usa `chat_messaggi_interni` |
| `src/pages/ComunicazioniPage.tsx` | Rinomina + passa prop ambito alla sidebar |
| `src/pages/cliente/ClienteComunicazioni.tsx` | Riscrittura completa: chat funzionante con canali contestuali |
| `src/components/AppSidebar.tsx` | Label "Comunicazioni" → "Chat" |
| `src/components/ClienteLayout.tsx` | Label "Comunicazioni" → "Chat" |
| `src/routes/sistema.tsx` | Rotta `/comunicazioni` → `/chat` |
| `src/routes/cliente.tsx` | Rotta `/cliente/comunicazioni` → `/cliente/chat` |
| `src/pages/cliente/ClienteDashboard.tsx` | Aggiorna link |

### Flusso risultante

```text
STAFF (Admin/Ufficio/...)
├── /chat
│   ├── [Tab Interna] → canali diretti/gruppo/broadcast tra staff
│   └── [Tab Contestuale] → canali legati a cliente/polizza/trattativa/sinistro
│       ├── Creati automaticamente da ChatTab nelle schede entita
│       └── Creati manualmente con "Nuova chat contestuale"

CLIENTE (portale)
├── /cliente/chat
│   └── Vede solo canali contestuali dove e membro + visibile_cliente=true
│       └── Puo scrivere e ricevere risposte dallo staff
```

