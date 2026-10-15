---
name: Demo Comune Roma Capitale
description: Utenza demo cliente ente per presentazioni area riservata /cliente (dati anonimizzati, area Roma)
type: feature
---

## Credenziali portale cliente

- **URL login:** https://cbnet.it/login (locale: http://localhost:5175/login)
- **Email:** demo.comune.roma@consulbrokers.it
- **Password:** Leone123!
- **Cliente ID:** e8f4a2b0-7c3d-4e1f-9a6b-2d4e8f1c0b5a
- **Codice ricerca:** COMUNE_ROMA_DEMO

## Deploy dati

1. Applicare migration `20261015190000_seed_comune_roma_demo.sql`
2. Invocare edge function `seed-comune-roma-demo` (service role) per Auth + PDF Storage
3. Deploy function se nuova: `supabase functions deploy seed-comune-roma-demo`

## Contenuto demo

- 12 polizze `DEMO-RM-*` (RC patrimoniale, RCT/O, All Risks, infortuni, RCA parco veicoli, tutela, cyber)
- 3 polizze CGA `approvato` per assistente IA (`chiedi-mie-polizze`)
- 7 sinistri `SIN-RM-*` geolocalizzati a Roma (lat/lng)
- 8 mezzi libro matricola su polizze RCA (2025 + 2026)
- Documenti PDF placeholder anonimizzati in `documenti_clienti` / `documenti_titoli`

## Esclusione report produzione

`numero_titolo NOT LIKE 'DEMO-RM-%' AND numero_sinistro NOT LIKE 'SIN-RM-%'`
