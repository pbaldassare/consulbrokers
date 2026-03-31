

## Piano: Creare Prospect "Comune di Varese" con Trattativa

### Dati del Prospect (Ente pubblico)

| Campo | Valore |
|-------|--------|
| nome | Comune di Varese |
| cognome | *(vuoto — è un ente)* |
| email | protocollo@comune.varese.it |
| telefono | 0332 255111 |
| fonte | Bando pubblico |
| stato | nuovo |
| note | Ente pubblico — Comune di Varese, P.IVA 00291010121, Via Sacco 5, 21100 Varese (VA). Settore: Pubblica Amministrazione Locale. |

### Trattativa simulata

| Campo | Valore |
|-------|--------|
| prodotto | Polizza RCT/O Enti Pubblici |
| compagnia | Generali Italia |
| premio_previsto | 18500.00 |
| stato | in_trattativa |

Dati coerenti: il Comune di Varese necessita tipicamente di copertura Responsabilità Civile verso Terzi e Operai (RCT/O), la compagnia Generali è tra le principali per il segmento PA, e il premio è realistico per un comune di ~80.000 abitanti.

### Esecuzione

1. INSERT prospect con i dati sopra → ottengo `prospect_id`
2. INSERT trattativa collegata al prospect

### File coinvolti
Nessuna modifica al codice. Solo operazioni dati.

