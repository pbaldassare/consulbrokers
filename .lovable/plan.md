
## Cosa ho capito dal file `anagrafica_Napoli_giugno_2026.xls`

Il file contiene **31 righe** con tantissimi doppioni (la stessa anagrafica ripetuta più volte). Le **anagrafiche univoche** sono **12**, di cui **4 già presenti** in DB e collegate all'Ufficio di Napoli — quindi **da inserire ne restano 8**.

### Già presenti (skip, nessun re-insert)
| Codice | Nome |
|--------|------|
| 002705 | CANTIERE NAVALE BASILIO POSTIGLIONE SRL |
| 017498 | COMUNE DI AFRAGOLA |
| 017587 | RENT AND EVENTS SRL |
| 017605 | COMUNE DI POMIGLIANO D'ARCO |

### Da inserire (8)
| Codice | Tipo | CF/P.IVA | Nome | Gruppo Fin. |
|--------|------|----------|------|-------------|
| 017823 | Privato | GNGFRC90H48D969O | GIANGRIECO FEDERICA | Linea Persona |
| 014557 | Azienda | 02218910715 | AOU OSPEDALI RIUNITI DI FOGGIA | Aziende Sanitarie Pubbliche |
| 006883 | Azienda | 06391740724 | ASL BAT | Aziende Sanitarie Pubbliche |
| 014559 | Azienda | 02026690731 | ASL TARANTO | Aziende Sanitarie Pubbliche |
| 006975 | Ente Pub. | **MANCANTE** | COMUNE DI SANTA MARINA SALINA | Enti Pubblici Territoriali |
| 017725 | Ente Pub. | 97530810015 | ASSOCIAZIONE TITOLARI DI FARMACIA TORINO | Enti Pubblici Territoriali |
| 006453 | Azienda | 04336340726 | SITA SUD SRL | Aziende Private |
| 008510 | Azienda | 00405460585 | TROTTA BUS SERVICES S.P.A. | Aziende Private |

### Dati che mancano (regola anti-dati-inventati)
- **COMUNE DI SANTA MARINA SALINA** (cod. 006975): CF/P.IVA non presente nel file. Lo inserisco con `codice_fiscale_azienda = NULL` e nota `"DA COMPLETARE - CF/P.IVA non disponibile in import Napoli 06/2026"`, esattamente come fatto per Bergamo. Da completare a mano dal frontend.

Tutti gli altri 7 hanno CF/P.IVA validi nel file.

### Collegamenti (no invenzioni)
- **Ufficio** → `Ufficio di Napoli` (`f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a`) per tutti.
- **gruppi_finanziari** → uso gli ID esistenti (Aziende Private / Linea Persona / Aziende Sanitarie Pubbliche / Enti Pubblici Territoriali). Esistono dei doppioni nella tabella `gruppi_finanziari` ma li ignoro (non li sistemo qui).
- **Indirizzo/CAP/Comune/Email/Telefono** → presi dal file così come sono.

### `codici_commerciali_cliente`
Per ogni nuovo cliente creo i 3 ruoli (come per Bergamo):
- **Backoffice (Specialist)**: lookup su `profiles` per `GUARRACINO GAETANO` / `SCARPELLI PAOLA` / `Gestione Milano`. Se non trovato → solo `contatto` testuale.
- **Produttore Sede**: lookup su `anagrafiche_professionali` per `INTERFIDI SRL` / `E.M.A. SOLUZIONI ASSICURATIVE SRL` / `COMODO EGIDIO` / `Consulbrokers Digital Srl` / `FEDERFARMA INSURANCE BROKER SRL`. Tutti presenti tranne eventuali ambiguità.
- **AE**: il file ha valori tipo `SEDE NAPOLI`, `AZIENDE SANITARIE`, `SEDE BASILICATA`, `SEDE CATANIA`, `FEDEFARMA INSURANCE BROKER` → **non sono persone**, sono etichette di AE/struttura. Le salvo come `contatto` testuale sul ruolo `AE` senza `profilo_id` né `anagrafica_id` (così l'informazione resta visibile ma non collegata a falsi profili).

### Note tecniche
- Doppio `COMODO EGIDIO` in `anagrafiche_professionali`: uso il record `c691fc2e-aa7d-4732-80c9-da91a50f4a9b` (ragione_sociale "COMODO EGIDIO", senza cognome). Non risolvo il duplicato qui.
- Esecuzione via `INSERT` puntuali (8 clienti + relativi `codici_commerciali_cliente`) — niente edge function nuova.

### Domanda
Confermi che per **COMUNE DI SANTA MARINA SALINA** vada bene `CF = NULL` + nota "DA COMPLETARE" (stesso comportamento di Bergamo)? Se sì procedo.
