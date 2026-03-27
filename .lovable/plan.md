

## Piano: Aggiungere città e altri campi alla ricerca clienti

### Problema
La ricerca filtra solo su nome/cognome/CF/email (privati) e ragione_sociale/PIVA/CF/email/PEC (aziende/enti). Non cerca su **città**, **telefono**, **indirizzo** — quindi "santa" per trovare Santa Marina Salina non funziona.

### Soluzione
In `src/pages/ClientiList.tsx` (righe 487-505), aggiungere `citta_sede`, `citta_residenza`, `telefono`, `indirizzo_sede` ai campi cercati, sia per privati che per aziende/enti.

**Privati** — aggiungere: `citta_residenza`, `citta_sede`, `telefono`
**Aziende/Enti** — aggiungere: `citta_sede`, `telefono`

Questo rende la ricerca completa su tutti i campi visibili nelle tabelle.

