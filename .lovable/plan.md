## Problema

Il login con `protocollo@comune.it` / `Leone123!` ha successo (auth log status 200), ma il `ClienteGuard` reindirizza immediatamente a `/login` perché il record `clienti` collegato (`94dc5a3c-1682-4aea-a9e2-190bf8bf34b1` – Comune di Varese) ha `area_riservata_tipo = 'nessuna'`.

Regola in `src/components/ClienteGuard.tsx` (riga 46):
```ts
if (areaType === "nessuna") return <Navigate to="/login" replace />;
```

## Fix

1. **Migrazione DB**: settare `clienti.area_riservata_tipo = 'completa'` per il cliente Comune di Varese (id `94dc5a3c-1682-4aea-a9e2-190bf8bf34b1`), così il portale `/cliente` viene mostrato con accesso pieno (dashboard, polizze, sinistri, pagamenti, documenti, scadenze).
2. **Verifica**: rieseguire login → atterraggio su `/cliente` con i dati demo già seedati (5 polizze + 4 sinistri).
3. **Aggiornare memory** `.lovable/memory/demo/comune-varese-ente.md` con la nota che `area_riservata_tipo` deve essere diverso da `nessuna`.

Nessuna modifica al codice frontend necessaria.
