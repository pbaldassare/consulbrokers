

## Sedi presenti nel database

In totale ci sono **7 sedi** (tutte attive), ma solo **2 sono "reali"** con dati operativi. Le altre **5 sono di demo** (codice prefisso `DEMO-*`, 0 clienti, 0 utenti).

### Sedi reali (con dati)
| Codice | Nome | Clienti | Utenti |
|---|---|---|---|
| — | Ufficio di Napoli | 548 | 1 |
| SDO | SEDE SAN DONA' DI PIAVE | 3 | 1 |

### Sedi demo (vuote, da pulire eventualmente)
- DEMO-NAP — Agenzia Napoli
- DEMO-ROMA — Sede Centrale Roma
- DEMO-BOL — Punto Vendita Bologna
- DEMO-FIR — Filiale Firenze
- DEMO-MIL — Filiale Milano

### Note
- **Ufficio di Napoli** non ha `codice_ufficio` impostato (NULL) — coerente con la regola di setup Napoli (`profilo_id` null per Prod1/2/3).
- Le sedi demo sembrano dati di test/seed, probabilmente da rimuovere o nascondere se non servono per la demo del portale.

Vuoi che proceda a:
1. **Eliminare le 5 sedi demo** dal DB
2. **Filtrare le sedi demo** dalla UI di Gestione Sedi (mostrando solo quelle con `codice_ufficio NOT LIKE 'DEMO-%'`)
3. **Lasciare tutto invariato** (era solo una domanda informativa)

