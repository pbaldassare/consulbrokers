# Sinistri/Polizze/Scadenze vuoti su /cliente — diagnosi e fix

## Causa più probabile

I dati esistono in DB, l'RLS è corretto, le query frontend sono corrette. La RPC `get_my_cliente_ids()` ritorna però array vuoto, il che significa che l'utente attualmente loggato nella preview **non è** `protocollo@comune.it`.

Possibili scenari:
1. Sei loggata con un altro utente (es. admin) e poi hai aperto `/cliente/...` direttamente — `ClienteGuard` non blocca admin/cliente in modo distinto.
2. La sessione `protocollo@comune.it` è scaduta o stantia (salvata prima dell'assegnazione `user_id` al cliente).
3. Le migration di seed hanno assegnato il `cliente.user_id` corretto, ma la JWT in `localStorage` è di un altro utente.

## Plan operativo

### Step 1 — Verifica utente loggato (1 secondo)
Aggiungo nel `ClienteDashboard` un piccolo banner debug visibile solo se `clienteIds.length === 0`, che mostra:
- email dell'utente loggato (`user.email`)
- esito RPC `get_my_cliente_ids()`
- bottone "Esci e accedi come Comune di Varese"

Così capiamo subito se è davvero un problema di sessione.

### Step 2 — Hard re-login
Forzo `supabase.auth.signOut()` + redirect a `/login` con email pre-compilata `protocollo@comune.it`.

### Step 3 — (Opzionale) Provisioning safety net
Edge function `reset-demo-password` già esistente: confermo che la password sia `Leone123!` per `protocollo@comune.it` e che `clienti.user_id` punti al suo `auth.users.id` (verificato: ✅ già allineato).

## File da toccare
- `src/pages/cliente/ClienteDashboard.tsx` — banner debug condizionale
- `src/pages/cliente/ClienteSinistri.tsx` / `ClientePolizze.tsx` / `ClienteScadenze.tsx` — stesso banner ridotto
- (no migration: il DB è già a posto)

## Cosa NON serve
- Nessuna nuova policy RLS
- Nessun nuovo seed dati
- Nessuna modifica alla RPC

## Azione che ti consiglio prima ancora di implementare
Apri la preview, fai logout e login con `protocollo@comune.it` / `Leone123!`. Se i dati appaiono, non serve neanche il banner. Fammi sapere cosa vedi e procedo di conseguenza.
