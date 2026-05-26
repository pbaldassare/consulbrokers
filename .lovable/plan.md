## Problema

La creazione dello Specialist fallisce con HTTP 500 dall'edge function `create-user`.

Causa: la funzione legge `Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!` ma in Supabase Edge Functions la variabile standard è `SUPABASE_ANON_KEY`. Il valore risulta `undefined` e `createClient(url, undefined)` lancia un'eccezione non gestita → 500 senza messaggio utile (tutte le altre edge function usano correttamente `SUPABASE_ANON_KEY`).

## Fix

In `supabase/functions/create-user/index.ts`:
- sostituire `Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!` con `Deno.env.get("SUPABASE_ANON_KEY")!`

Nessun'altra modifica necessaria (logica, payload e UI restano invariati).
