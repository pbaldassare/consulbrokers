## Obiettivo
Verificare e potenziare la gestione dello stato pratica sinistro: editabile da admin (anche se chiuso), tracciato nei log, e propagato in tempo reale a tutte le pagine che mostrano sinistri.

## Stato attuale
- ✅ **Admin può modificare**: `canManage = isAdmin || hasPermission("sinistri")` in `SinistroDetail.tsx:52`.
- ✅ **Log presenti**: la edge function `gestione-sinistri` (azione `cambia_stato`) scrive sia in `sinistro_eventi` (timeline) che in `log_attivita`.
- ❌ **Card nascosta quando chiuso**: `{canManage && !isChiuso && (...)}` → un admin non può riaprire un sinistro chiuso/respinto.
- ❌ **No realtime**: la tabella `sinistri` non è nella publication `supabase_realtime`; nessuna subscription nel frontend → liste e badge non si aggiornano finché l'utente non ricarica/cambia pagina.

## Modifiche

### 1. Migrazione DB — abilitare Realtime
Aggiungere `sinistri`, `sinistro_eventi`, `sinistro_checklist` alla publication `supabase_realtime` e impostare `REPLICA IDENTITY FULL` (per ricevere il payload completo sui change).

### 2. `src/pages/SinistroDetail.tsx` — admin può sempre cambiare stato
- Mostrare la card "Gestione Stato Pratica" anche quando il sinistro è chiuso/respinto, **se l'utente è admin** (`isAdmin`). Per i non-admin resta nascosta su pratiche chiuse.
- Etichetta dinamica: quando `isChiuso && isAdmin`, mostrare un avviso "Pratica chiusa: la riapertura è consentita solo agli amministratori".
- Aggiungere subscription Realtime (in `useEffect`) sulle tabelle `sinistri` (filtro `id=eq.<id>`), `sinistro_eventi` e `sinistro_checklist` (filtro `sinistro_id=eq.<id>`) per invalidare le query del dettaglio.

### 3. Realtime nelle liste/badge
Aggiungere subscription Realtime per invalidare le query React Query nelle pagine che mostrano lo stato sinistri:
- `src/pages/SinistriList.tsx` → invalidare `["sinistri-list", ...]` su qualsiasi change in `sinistri`.
- `src/components/SinistriClienteTab.tsx` → invalidare `["sinistri-cliente", clienteId]` su change in `sinistri` filtrati per `cliente_anagrafica_id`.
- `src/pages/ClienteDetail.tsx` → invalidare `["cliente_related_ids", id]` (badge tab Sinistri) su change in `sinistri` per quel cliente.

Pattern uniforme:
```ts
useEffect(() => {
  const ch = supabase
    .channel(`sinistri-rt-<scope>`)
    .on("postgres_changes", { event: "*", schema: "public", table: "sinistri", filter: "..." },
        () => qc.invalidateQueries({ queryKey: [...] }))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [deps]);
```

## Risultato atteso
- Admin vede sempre il pannello "Gestione Stato Pratica" e può riaprire un sinistro chiuso.
- Ogni cambio stato resta registrato in timeline (`sinistro_eventi`) e in `log_attivita`.
- Liste sinistri, badge tab "Sinistri" sul cliente e card riassuntive si aggiornano in tempo reale senza ricaricare.
