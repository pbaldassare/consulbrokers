## Stato attuale nella scheda Cliente → Polizze del cliente

La tabella `PolizzeClienteTable` (in `src/pages/ClienteDetail.tsx`) usa già `groupTitoliByPolizza`:
- Le **polizze madri** sono le righe principali (badge "Polizza")
- Le **quietanze** sono dentro l'expand della madre (badge "Quietanza N", riga rientrata con ↳)

Però **non c'è coerenza** con quanto fatto nelle pagine portafoglio (Carico/Attive/Storico):
- Il contatore tab dice "Polizze (5)" ma somma madri + quietanze → fuorviante.
- Non c'è un filtro Tipo per vedere solo polizze o solo quietanze "appiattite".
- Le quietanze si vedono solo aprendo l'expand.

## Cosa propongo

### 1. Tab counter separato
Cambio il label da `Polizze (5)` a **`Polizze (4) · Quietanze (1)`** — conteggio reale dei due tipi nella query già caricata.

### 2. Filtro Tipo sopra la tabella
Stesso pattern delle pagine portafoglio:
```
Tipo: [ Polizze + Quietanze ▾ ]  →  Polizze + Quietanze | Solo polizze | Solo quietanze
```
- **Polizze + Quietanze** (default) → comportamento attuale: madri con expand
- **Solo polizze** → solo le madri, niente expand
- **Solo quietanze** → tabella appiattita di sole quietanze (ognuna su riga propria, con riferimento alla polizza madre)

### 3. KPI mini-riepilogo opzionale
Sopra la tabella, una riga sottile: `4 polizze · 1 quietanza · totale premio €X`. Niente card pesanti, solo testo informativo.

### 4. Cosa NON cambia
- Logica DELETE admin (cestino) invariata
- `groupTitoliByPolizza` invariato
- Niente migration

Confermi?