

## Aggiunta sezione "Dove sono salvati" in TitoloDetail

### Obiettivo

Aggiungere una sezione informativa nel dettaglio polizza (`TitoloDetail.tsx`) che spiega, per ciascuna operazione del ciclo vita polizza (Regolazione, Sospensione, Riattivazione, Sostituzione/Rinnovo, Appendici), **quali tabelle vengono aggiornate** e **quali righe vengono inserite in `movimenti_polizza`**. Serve come reference rapido in-app per l'utente.

### Dove inserirla

In `src/pages/TitoloDetail.tsx`, dopo la sezione "Operazioni" (i pulsanti Sospensione/Riattivazione/Rinnovo/Storno), aggiungere un blocco `Collapsible` chiuso di default con titolo **"Dove sono salvati i dati"** + icona `Database`/`Info`. L'utente lo apre solo se vuole capire la persistenza.

### Contenuto della sezione

Una `Card` con 5 sotto-blocchi (uno per operazione), ciascuno strutturato come:

```text
[Icona] Nome Operazione
├─ Tabella header aggiornata: titoli (campi modificati: stato, ...)
├─ Movimento creato: movimenti_polizza tipo_documento='XX'
├─ Tabelle collegate: (es. appendici_polizza, attivita_log)
└─ Note: (es. "lo storno non genera ancora movimento dedicato")
```

**Mappa operazioni → persistenza** (estratta dal codice attuale):

| Operazione | titoli (update) | movimenti_polizza (insert) | Altre tabelle |
|---|---|---|---|
| **Regolazione** | `regolazione=true`, `tipo_scadenza`, `periodicita` | — (nessun movimento dedicato) | `attivita_log` |
| **Sospensione** | `stato='sospeso'`, `data_sospensione` | `tipo_documento='SO'`, `data_movimento`, `note` | `attivita_log` |
| **Riattivazione** | `stato='attivo'`, `data_riattivazione` | `tipo_documento='RA'`, `data_movimento`, `note` | `attivita_log` |
| **Sostituzione/Rinnovo** | nuovo record `titoli` (numero_titolo nuovo) + `sostituito_da_id` sul vecchio | `tipo_documento='RN'` sul nuovo titolo | `attivita_log` (su entrambi) |
| **Appendice** | — (titolo invariato) | `tipo_documento='AP'` (riferimento) | `appendici_polizza` (record principale + file su Storage) |
| **Storno** ⚠️ | `stato='scaduto'`, `data_storno` | — (gap noto: nessun movimento `ST` generato) | `attivita_log` |

### Modifiche file

- **`src/pages/TitoloDetail.tsx`**: aggiungere import `Collapsible/CollapsibleContent/CollapsibleTrigger`, icona `Database`, e il nuovo blocco JSX dopo la sezione Operazioni. Nessuna modifica logica/dati — è solo contenuto descrittivo statico.

### Cosa NON faccio (in questo plan)

- **Non aggiungo** il movimento dedicato per Storno (`ST`): è un gap reale ma è una modifica funzionale separata. Lo segnalo solo come "Nota" nella card per trasparenza. Se vuoi chiuderlo, lo facciamo in un secondo plan (richiede insert in `movimenti_polizza` dentro `StornoPolizzaPage.tsx` + eventuale aggiornamento del check constraint sui `tipo_documento` ammessi).
- Non modifico la logica esistente di nessuna operazione.

### Verifica

1. Apro una qualsiasi polizza → scorro sotto la sezione "Operazioni" → vedo accordion chiuso "Dove sono salvati i dati".
2. Click sull'accordion → si espande mostrando le 5 card con tabelle + tipo_documento.
3. La sezione è puramente informativa: nessun pulsante che esegue azioni.

