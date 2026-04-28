## Stato attuale (verificato)

In `supabase/functions/calcola-provvigioni/index.ts` (path primario, quando `provvigioni_quietanza > 0`) la logica è già corretta concettualmente:

- Se esiste un commerciale e `percentuale_commerciale < 100` → 2 righe in `provvigioni_generate`:
  - `tipo_destinatario = 'commerciale'`, `user_id = commerciale_id`, importo = `provvQ * %comm/100`
  - `tipo_destinatario = 'consul'`, `user_id = NULL`, importo = differenza (la quota di Consulbrokers SPA / casa madre)
- Se non c'è commerciale o `%comm = 100` → 1 riga `'consul'` con il 100%.

Frontend (`TitoloDetail.tsx`, sezione "Commerciale & Provvigioni") mostra correttamente `Provv. Commerciale` e `Provv. Consul` calcolati live.

DB conferma: 132 righe `commerciale` (€ 8.111,52) e 290 righe `consul` (€ 281.898,97).

## Problemi rilevati

1. **Etichetta ambigua**: la quota residua è `tipo_destinatario = 'consul'` ma rappresenta in realtà la **casa madre Consulbrokers & Partners SPA** (admin). Confondere "Consul" (intermediario rete) con "Consulbrokers SPA" (admin/broker capofila) crea ambiguità in report e export.
2. **Caso "commerciale = Consulbrokers SPA"**: oggi se l'anagrafica commerciale è la stessa Consulbrokers SPA, vengono comunque generate 2 righe distinte (`commerciale` + `consul`) con divisione economica reale, mentre l'utente vuole che in quel caso lo split sia **solo statistico** (le due quote vanno alla stessa entità, nessuna separazione economica reale).
3. Nessuna identificazione persistente di "chi è l'admin" → manca un puntatore a Consulbrokers SPA (esiste già come `anagrafiche_professionali` id `b5029abb-72dd-454f-bbd1-2d758964a379`, ragione "CONSULBROKERS & PARTNERS SPA").

## Piano

### 1. Settings: identificare l'admin (Consulbrokers SPA)
Inserire in `impostazioni_sistema` la chiave `admin_anagrafica_id` con valore JSON `{ "anagrafica_id": "b5029abb-72dd-454f-bbd1-2d758964a379" }`. Una piccola UI in `ImpostazioniPage` per cambiarla (SearchableSelect su `anagrafiche_professionali`).

### 2. Edge function `calcola-provvigioni` — refinement
- Leggere `admin_anagrafica_id` da `impostazioni_sistema`.
- Rinominare `tipo_destinatario = 'consul'` per la quota residua in **`'admin'`** (più chiaro: rappresenta Consulbrokers SPA). Mantenere `'consul'` solo per il fallback "no commerciale" legacy se serve, oppure migrare anche quello a `'admin'`.
- **Caso speciale**: se `anagrafica_commerciale_id == admin_anagrafica_id` → generare comunque 2 righe per fini statistici, ma con un flag `solo_statistico = true` sulla riga `commerciale` (quella che altrimenti rappresenterebbe doppio pagamento). I report finanziari sommano solo righe con `solo_statistico = false`; i report statistici le sommano tutte.

### 3. Schema DB
- Aggiungere `provvigioni_generate.solo_statistico boolean NOT NULL DEFAULT false`.
- Aggiornare il CHECK / commento su `tipo_destinatario` per documentare i valori: `'commerciale' | 'admin' | 'consul' (legacy)`.
- Migrazione one-shot: rietichettare le 290 righe esistenti `'consul'` → `'admin'` quando provengono da titoli con commerciale valorizzato (split reale); lasciare `'consul'` se provengono dal fallback.

### 4. Frontend
- `TitoloDetail.tsx`: nella sezione "Commerciale & Provvigioni" rinominare la riga `Provv. Consul` in **`Provv. Consulbrokers SPA (admin)`**. Se il commerciale coincide con l'admin, mostrare un badge "Split solo statistico — stessa entità" e riportare un unico totale economico.
- `ProvvigioniMaturatePage`: aggiungere colonna/badge per distinguere `commerciale` / `admin (Consulbrokers SPA)` / `solo statistico`. Il filtro `.neq("tipo_destinatario", "consul")` esistente diventa `.neq("solo_statistico", true)` per escludere le righe puramente statistiche dai pagamenti reali.
- Aggiornare le legend e i tooltip dove appare "Consul" per chiarire la differenza tra "Consul" (rete intermediari) e "Consulbrokers SPA" (admin/casa madre).

### 5. Report e estrazioni
Verificare che `ProvvigioniSedePage`, `EstrazioniStampe` e i report contabili usino `solo_statistico = false` quando aggregano valori monetari reali, e ignorino il flag quando producono statistiche di produzione per commerciale.

### 6. Memoria
Aggiornare `mem://insurance/policy-commission-split` (o crearla se mancante) con:
- Regola: quota residua = Consulbrokers SPA (admin), `tipo_destinatario = 'admin'`.
- Eccezione: se commerciale = admin, split solo statistico (`solo_statistico = true` sulla riga commerciale).
- Pointer all'`admin_anagrafica_id` in `impostazioni_sistema`.

## Cosa NON cambia

- La logica matematica dello split (`provvQ * %comm/100`) rimane identica.
- Le percentuali in `titoli.percentuale_commerciale` non vengono toccate.
- I pagamenti già emessi (`pagamenti_provvigioni`) restano invariati.
