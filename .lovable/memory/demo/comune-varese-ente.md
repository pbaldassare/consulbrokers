---
name: Demo Comune di Varese
description: Utenza demo cliente ente "Comune di Varese" con polizze e sinistri simulati per il portale /cliente
type: feature
---

## Credenziali login portale cliente
- **Email**: protocollo@comune.it
- **Password**: Leone123!
- **Profile ID**: 746c540d-7e65-417d-9834-39612c13213a (ruolo `cliente`)
- **Cliente ID**: cercare ragione_sociale='Comune di Varese' in `clienti`
- **Sede**: SEDE SAN DONA' DI PIAVE (327e92f7-64f0-48b9-9e48-73611d8cb406)

## Dati simulati (marcati [DEMO] nelle note)
- 5 polizze `titoli` numero `DEMO-VA-2025-001..005` (RC Patrimoniale, All Risks, Infortuni, RCA Parco, Tutela Legale) — premio totale ~€108k
- 4 sinistri `sinistri` numero `SIN-VA-2025-001..004` (2 aperti/in lavorazione, 2 chiusi)
- Compagnie: Generali, Allianz, Lloyd's

## Esclusione dai report finanziari reali
Per escludere i dati demo dai report di produzione filtrare:
```sql
WHERE numero_titolo NOT LIKE 'DEMO-VA-%' AND numero_sinistro NOT LIKE 'SIN-VA-%'
```
o più genericamente `WHERE note IS NULL OR note NOT LIKE '[DEMO]%'`.

## Conversione prospect → cliente
Il record `prospect` 68178b0a-6fd9-41cf-a74a-f09a91a5d5d4 ha `convertito_cliente_id` valorizzato verso il cliente ente.
