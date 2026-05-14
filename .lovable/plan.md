# Quietanze non visibili nel "Carico del Mese"

## Diagnosi

La polizza 122 (Interfidi, Sede Napoli) è stata messa a cassa il 14/05/2026. Il trigger `genera_quietanza_su_messa_cassa` ha correttamente creato la quietanza successiva (riga 1, sostituisce 122/0).

Però la nuova quietanza è stata salvata con:
- `garanzia_da = 2027-05-14`
- `garanzia_a  = 2028-05-14`
- `data_scadenza = 2028-05-14`  ← problema

La pagina **Carico del Mese** filtra per `data_scadenza` nel mese visualizzato. Quindi la quietanza "appare" solo a Maggio **2028**, non a Maggio 2027 — contrariamente a quanto dichiarato nella memoria `auto-quietanza-su-messa-cassa` («annuale 14/05/2026 → quietanza 14/05/2027 in Carico 05/2027»).

Convenzione corretta: la quietanza deve essere "in carico" nel mese in cui scade il pagamento, ovvero alla **decorrenza** (`garanzia_da` / `durata_da`), non alla fine del periodo coperto.

## Fix

### 1. Trigger DB (`genera_quietanza_su_messa_cassa`)
Modificare la INSERT (riga 132 attuale): cambiare l'ordine `durata_da, durata_a, data_scadenza, data_competenza` da
```
v_new_da, v_new_a, v_new_a, v_new_da
```
a
```
v_new_da, v_new_a, v_new_da, v_new_da
```
Così `data_scadenza` della nuova quietanza coincide con la sua decorrenza (= mese di carico).

### 2. Backfill quietanze già generate
Per le quietanze esistenti create da questo trigger (identificabili da `sostituisce_polizza IS NOT NULL` AND `stato='attivo'` AND `data_scadenza = garanzia_a`), allineare `data_scadenza := garanzia_da`. Caso noto: titolo `e194f418-617e-41d8-8638-836635481b24` (numero 122 riga 1) → `data_scadenza` da 2028-05-14 a 2027-05-14.

### 3. Aggiornare la memoria
Aggiungere nota in `auto-quietanza-su-messa-cassa.md`: «`data_scadenza` della nuova quietanza = decorrenza (`garanzia_da`), non fine periodo, per coerenza con Carico del Mese».

## Verifica

Dopo migration: navigare a `/portafoglio/carico` con `Maggio 2027` → la quietanza 122/1 (Interfidi, € 138,47) deve comparire nella tabella, con totale premio aggiornato.

## Out of scope

Non si tocca la pagina (`PortafoglioCaricoPage.tsx`), né il calcolo provvigioni, né le righe già messe a cassa.
