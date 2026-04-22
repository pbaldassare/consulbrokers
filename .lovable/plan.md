

## Campi categorizzabili dello storico gare → filtri & AI

Dei ~20 campi grezzi del file, 9 sono **categorizzabili** (valori finiti, normalizzabili, utili come filtro/aggregazione). Gli altri restano come testo libero o dati numerici/data.

### A. Categorici puri → filtri a tendina + raggruppamenti AI

| Campo nuova tabella | Tipo | Valori canonici | Cardinalità attesa | Uso |
|---|---|---|---|---|
| **anno_riferimento** | int | 2013 → 2025 | ~13 | Filtro principale, trend annuale |
| **provincia** | text(2) | TV, VE, PD, MI, RM, NA… | ~30-50 | Filtro geografico, mappa |
| **tipologia** | enum | `manifestazione`, `gara`, `affidamento_diretto`, `altro` | 4 | Filtro funnel, KPI tasso vinte per tipo |
| **esito** | enum | `vinta`, `persa`, `non_partecipato`, `annullata`, `in_corso`, `non_classificato` | 6 | KPI win-rate, dashboard |
| **broker_incumbent** | text normalizzato | `INTERMEDIA`, `B&S ITALIA`, `AON`, `MARSH`, `WILLIS`, `MAG JLT`, `ALTRO` | ~15-20 | Analisi competitor, "chi gestisce X" |
| **categoria_ente** | enum derivato dal nome | `comune`, `provincia`, `regione`, `azienda_sanitaria`, `universita`, `consorzio`, `societa_partecipata`, `altro_ente` | 8 | Segmentazione PA |
| **stato_mandato** | enum derivato da date | `attivo`, `in_scadenza_12m`, `scaduto`, `sconosciuto` | 4 | **Trigger commerciale**: chi rifare offerta |
| **flag_cauzione / referenze / accesso_atti / offerta_tecnica** | bool×4 | true/false/null | 2+null | Filtri requisiti, "gare con cauzione" |
| **opzione_rinnovo_anni** | int derivato | 0,1,2,3,4,5 | 6 | "Mandati con opzione +3" |

### B. Testuali liberi → ricerca FTS + indicizzazione AI (NON categorici)

| Campo | Perché non categorizzato | Come lo uso |
|---|---|---|
| `ente_nome` | Migliaia di valori unici | FTS + auto-link a `clienti` |
| `note` | Testo libero, ogni riga diversa | FTS, parsing AI per estrarre esito |
| `contatto_riferimento` / `telefono` | PII, libero | Solo display |

### C. Numerici/Data → range & aggregati (non tendine)

`data_consegna`, `data_inizio_mandato`, `data_fine_mandato`, `pagine_offerta_tecnica` → filtri "da/a" e bucket dinamici.

### Normalizzazioni necessarie all'import (per rendere categorizzabili)

1. **broker_incumbent**: dictionary mapping (es. `B&S` / `B&S ITALIA` / `B & S` → `B&S ITALIA`; `WILLIS` / `WILLS` / `WTW` → `WILLIS`).
2. **categoria_ente**: regex sul nome (`^COMUNE` → `comune`, `^A.S.L.|AZIENDA SANITARIA` → `azienda_sanitaria`, `UNIVERSIT` → `universita`, ecc.).
3. **esito**: parsing case-insensitive delle NOTE (`AGGIUDICATA|VINTA` → vinta, `ANNULLATA|REVOCATA` → annullata, `NON ESTRATT|NON SORTEGG` → non_partecipato).
4. **stato_mandato**: calcolato lato vista SQL (`v_storico_gare`) confrontando `data_fine_mandato` con `now()`.
5. **opzione_rinnovo_anni**: regex `[+]?\s*(\d+)\s*ANN` su `opzione_rinnovo`.

### Cosa cambia nel piano già approvato

Aggiungo alla tabella `storico_gare` 2 colonne derivate:
- `categoria_ente text` (popolata in import + trigger su INSERT/UPDATE).
- `stato_mandato` come **vista calcolata** (non colonna), per restare sempre fresca.

E aggiungo alla pagina `/trattative/storico-gare` 7 filtri (anno, provincia, tipologia, esito, broker, categoria_ente, stato_mandato) + 4 toggle booleani per i flag requisiti.

### Cosa ottiene l'Assistente IA con questa categorizzazione

Esempi di query naturali ora risolvibili senza FTS pesante:
- "Quanti comuni del Veneto ha gestito Intermedia negli ultimi 5 anni?" → `WHERE categoria_ente='comune' AND provincia IN (...) AND broker_incumbent='INTERMEDIA' AND anno_riferimento >= 2020`
- "Quali mandati scadono entro 12 mesi e abbiamo perso in passato?" → `stato_mandato='in_scadenza_12m' AND esito='persa'`
- "Win rate per anno sulle manifestazioni vs gare" → `GROUP BY anno_riferimento, tipologia`
- "Aziende sanitarie che richiedono cauzione e referenze bancarie" → `categoria_ente='azienda_sanitaria' AND flag_cauzione AND flag_referenze_bancarie`

Per abilitare questi pattern aggiungo a `schema-context.ts` la tabella `storico_gare` con la lista esatta dei valori enum di ogni campo (così l'AI sa cosa filtrare senza tirare a indovinare).

### Verifica

1. Apro `/trattative/storico-gare`: vedo 7 dropdown popolati con i valori canonici sopra.
2. Filtro `categoria_ente=comune, provincia=TV, esito=vinta` → conteggio coerente.
3. Chiedo all'AI "broker dominante nei comuni del Veneto" → risponde con aggregato su `broker_incumbent` filtrato.
4. Chiedo "mandati in scadenza nei prossimi 12 mesi gestiti da Intermedia" → restituisce lista corretta basata su `stato_mandato`.

