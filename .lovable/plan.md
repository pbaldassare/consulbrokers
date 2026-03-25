

## Piano: Portale Cliente (PWA + Desktop)

### Stato attuale

**Cosa esiste gia:**
- Tabella `clienti` con anagrafica completa, ma **senza collegamento a `auth.users`** (manca `user_id`)
- Tabella `titoli` con `cliente_id` (FK profiles) e `cliente_anagrafica_id` (FK clienti) per le polizze
- Tabella `documenti` con campo `visibile_al_cliente` (boolean) gia predisposto
- Tabella `notifiche` con `destinatario_id` (FK profiles) — utilizzabile per il cliente
- Sistema di chat interno (canali diretti/gruppo/broadcast) con RLS che esclude ruolo "cliente"
- `profiles.ruolo` gestisce i ruoli, `permessi_json` per permessi granulari
- AuthGuard e RoleGuard gia funzionanti
- Bucket storage per documenti clienti/titoli/sinistri

**Cosa manca:**
1. **Collegamento `clienti` ↔ `auth.users`**: serve un campo `user_id` sulla tabella `clienti` per sapere quale utente Supabase corrisponde a quale anagrafica cliente
2. **Layout cliente dedicato**: il MainLayout attuale mostra la sidebar gestionale completa — serve un layout semplificato per il cliente
3. **Pagine del portale cliente**: nessuna pagina cliente-oriented esiste
4. **RLS per accesso cliente**: le policy attuali non prevedono accesso client-side filtrato per il singolo cliente
5. **PWA**: non configurata

---

### Piano di implementazione (6 step)

#### Step 1 — Migration: collegare `clienti` a `auth.users`
Aggiungere `user_id uuid REFERENCES auth.users(id)` alla tabella `clienti` con indice unico. Questo permette al cliente autenticato di recuperare la propria anagrafica.

#### Step 2 — RLS policies per il portale cliente
Creare policy su:
- `clienti`: SELECT dove `user_id = auth.uid()`
- `titoli`: SELECT dove `cliente_anagrafica_id` IN (clienti del user)
- `documenti`: SELECT dove `entita_id` corrisponde a un titolo/cliente del user E `visibile_al_cliente = true`
- `notifiche`: SELECT/UPDATE dove `destinatario_id = auth.uid()`

Usare una funzione `security definer` `get_my_cliente_id()` per evitare ricorsioni RLS.

#### Step 3 — Layout cliente dedicato (`ClienteLayout`)
Creare `src/components/ClienteLayout.tsx` — layout semplificato con:
- Header con logo ConsulNet e nome utente
- Navigazione orizzontale o sidebar minimale con le voci: Dashboard, Polizze, Documenti, Scadenze, Comunicazioni, Notifiche, Pagamenti
- Footer con info contatto agenzia
- Responsive / mobile-first

Creare `src/components/ClienteGuard.tsx` che verifica `profile.ruolo === 'cliente'` e reindirizza al portale cliente se il ruolo e "cliente".

Modificare `AuthGuard` per reindirizzare i clienti verso `/cliente` invece della dashboard gestionale.

#### Step 4 — Pagine del portale cliente
Creare le seguenti pagine in `src/pages/cliente/`:

| Pagina | Descrizione |
|--------|-------------|
| `ClienteDashboard.tsx` | Riepilogo: polizze attive, prossime scadenze, notifiche non lette |
| `ClientePolizze.tsx` | Lista polizze (titoli) del cliente con stato, prodotto, scadenza |
| `ClientePolizzaDetail.tsx` | Dettaglio singola polizza con documenti allegati |
| `ClienteDocumenti.tsx` | Tutti i documenti visibili al cliente, con download |
| `ClienteScadenze.tsx` | Scadenziario personale (rate, rinnovi) |
| `ClienteComunicazioni.tsx` | Chat diretta con l'agenzia (canale dedicato) |
| `ClienteNotifiche.tsx` | Centro notifiche personale |
| `ClientePagamenti.tsx` | Placeholder predisposto per pagamenti futuri (Stripe) |
| `ClienteUploadDoc.tsx` | Upload documenti dal cliente verso l'agenzia |

#### Step 5 — Routing
Aggiungere in `App.tsx` un blocco di rotte `/cliente/*` protette da `ClienteGuard`:
```text
/cliente              → ClienteDashboard
/cliente/polizze      → ClientePolizze
/cliente/polizze/:id  → ClientePolizzaDetail
/cliente/documenti    → ClienteDocumenti
/cliente/scadenze     → ClienteScadenze
/cliente/comunicazioni → ClienteComunicazioni
/cliente/notifiche    → ClienteNotifiche
/cliente/pagamenti    → ClientePagamenti (placeholder)
```

#### Step 6 — PWA Setup
Installare `vite-plugin-pwa`, configurare manifest con nome "ConsulNet", icone, theme color. Aggiungere meta tag mobile a `index.html`. Questo rende l'app installabile da browser su smartphone.

---

### Dettagli tecnici

**Funzione DB helper:**
```sql
CREATE OR REPLACE FUNCTION public.get_my_cliente_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM clienti WHERE user_id = auth.uid()
$$;
```

**File da creare:**
- `src/components/ClienteLayout.tsx`
- `src/components/ClienteGuard.tsx`
- `src/pages/cliente/ClienteDashboard.tsx`
- `src/pages/cliente/ClientePolizze.tsx`
- `src/pages/cliente/ClientePolizzaDetail.tsx`
- `src/pages/cliente/ClienteDocumenti.tsx`
- `src/pages/cliente/ClienteScadenze.tsx`
- `src/pages/cliente/ClienteComunicazioni.tsx`
- `src/pages/cliente/ClienteNotifiche.tsx`
- `src/pages/cliente/ClientePagamenti.tsx`
- `src/pages/cliente/ClienteUploadDoc.tsx`

**File da modificare:**
- `src/App.tsx` — aggiungere rotte `/cliente/*`
- `src/components/AuthGuard.tsx` — redirect clienti a `/cliente`
- `vite.config.ts` — plugin PWA
- `index.html` — meta tag mobile

**Nota sui pagamenti:** La pagina Pagamenti sara un placeholder funzionale (mostra le scadenze da pagare) predisposto per integrazione Stripe futura. Le notifiche sono gia strutturate nel DB, verranno semplicemente filtrate per il `destinatario_id` del cliente.

