---
name: Demo Ente Pubblico
description: Utenza demo cliente ente per presentazioni area riservata /cliente (dati anonimizzati)
type: feature
---

## Credenziali portale cliente

- **URL login:** https://cbnet.it/login (locale: http://localhost:5175/login)
- **Email:** demo.ente@consulbrokers.it
- **Password:** Leone123!
- **Cliente ID:** e8f4a2b0-7c3d-4e1f-9a6b-2d4e8f1c0b5a
- **Codice ricerca:** ENTE_DEMO
- **Denominazione:** Demo Ente Pubblico

## Deploy dati

1. Migration `20261015190000_seed_comune_roma_demo.sql` + `20261015172000_demo_ente_generico_credenziali.sql`
2. Invocare edge function `seed-comune-roma-demo` (service role) per Auth + PDF Storage
3. Deploy function: `supabase functions deploy seed-comune-roma-demo`

## Contenuto demo

- Polizze `DEMO-RM-*`, sinistri `SIN-RM-*` (prefissi tecnici per esclusione report)
- CGA per assistente IA polizza
- Documenti PDF placeholder in `documenti_clienti` / `documenti_titoli` (cartella storage `demo-ente`)

## Esclusione report produzione

`numero_titolo NOT LIKE 'DEMO-RM-%' AND numero_sinistro NOT LIKE 'SIN-RM-%'`
