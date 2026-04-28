---
name: Policy commission split
description: Split provvigioni titolo tra Commerciale, Consulbrokers SPA (admin) e caso speciale "commerciale = admin"
type: feature
---

## Regola

Quando un titolo passa a `incassato`, l'edge function `calcola-provvigioni` genera righe in `provvigioni_generate` partendo da `titoli.provvigioni_quietanza` e `titoli.percentuale_commerciale`:

- Se esiste un commerciale (`anagrafica_commerciale_id` o `commerciale_id`) e `% < 100`:
  - Riga `tipo_destinatario = 'commerciale'`, importo = `provvQ * %comm/100`, `user_id = commerciale_id`
  - Riga `tipo_destinatario = 'admin'`, importo = differenza, `user_id = NULL` → quota di **Consulbrokers SPA** (casa madre)
- Se non c'è commerciale o `% = 100` → 1 riga `'admin'` con il 100%.

## Caso speciale: commerciale = admin

Se `anagrafica_commerciale_id == admin_anagrafica_id` (lette da `impostazioni_sistema.admin_anagrafica_id`, valore JSON `{"anagrafica_id": "..."}`), Consul è anche l'intermediario:
- Si generano **comunque 2 righe** per fini statistici.
- Riga `commerciale` con `solo_statistico = true` (NON va nei totali economici/pagamenti).
- Riga `admin` con l'importo **intero** (`provvigioni_quietanza`), `solo_statistico = false`.

## Filtro report/pagamenti

Per totali e distinte di pagamento usare `solo_statistico = false` (non più `tipo_destinatario != 'consul'`). Le righe `'consul'` legacy storiche restano in DB e contano come quota admin (fallback "no commerciale").

## Setting di riferimento

`impostazioni_sistema.chiave = 'admin_anagrafica_id'` →  
attualmente: `b5029abb-72dd-454f-bbd1-2d758964a379` (CONSULBROKERS & PARTNERS SPA, `anagrafiche_professionali`).

## File chiave

- `supabase/functions/calcola-provvigioni/index.ts` — generazione righe
- `src/pages/TitoloDetail.tsx` — UI sezione "Commerciale & Provvigioni" con badge "split solo statistico" e label `Provv. Consulbrokers SPA`
- `src/pages/ProvvigioniMaturatePage.tsx` — filtro `solo_statistico = false`, badge per `commerciale | admin | consul (legacy) | sede`
