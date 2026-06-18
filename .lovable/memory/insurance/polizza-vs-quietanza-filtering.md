---
name: Polizza vs Quietanza filtering
description: Filtro Tipo unificato (Polizze+Quietanze / Solo polizze / Solo quietanze) con badge per riga in Carico/Attive/Storico e ClienteDetail
type: feature
---
- Distinzione via `titoli.sostituisce_polizza`: NULL = polizza madre, valorizzato = quietanza.
- UI Tab unico "Polizze (n) · Quietanze (n)" con filtro `Tipo`:
  - **Polizze + Quietanze**: madri come righe principali, quietanze come righe espandibili (chevron) sotto la madre.
  - **Solo polizze**: solo madri, niente chevron.
  - **Solo quietanze**: vista flat di tutte le rate, con colonna "Polizza madre".
- Colonna `Tipo` nella tabella: badge `Polizza` o `Quietanza N`.
- Colonna `Polizza madre`: vuota per le madri, valorizzata col `numero_titolo` della madre per le quietanze.
- Vale per ClienteDetail e per le viste Portafoglio Carico/Attive/Storico (stesso pattern).
