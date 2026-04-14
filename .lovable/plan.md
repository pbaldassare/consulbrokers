

## Piano: Azioni operative per polizze attive nel dettaglio titolo

### Problema attuale
La card "Cambia Stato" mostra pulsanti generici (creato, incassato, stornato, annullato) che non corrispondono alle operazioni reali del ciclo vita di una polizza. Le pagine operative (Sospensione, Riattivazione, Storno, Duplicazione, Appendici, Regolazione) esistono già ma non sono collegate dal dettaglio polizza.

### Cosa cambia
Nel dettaglio polizza (`TitoloDetail.tsx`), per le **polizze attive** (non storico), sostituire la card "Cambia Stato" con una card **"Operazioni"** che mostra pulsanti specifici:

| Pulsante | Navigazione | Icona |
|----------|------------|-------|
| Sospensione | `/portafoglio/sospensione` | `Clock` |
| Riattivazione | `/portafoglio/riattivazione` | `CheckSquare` |
| Duplicazione | `/portafoglio/duplicazione` | `FileStack` |
| Appendici | `/portafoglio/appendici` | `FileText` |
| Storno | `/portafoglio/storno` | `ArrowRightLeft` |
| Regolazione | (scroll alla sezione Regolazione) | `RefreshCw` |
| Annullamento | Conferma + update stato "annullato" | `XCircle` |

Ogni pulsante naviga alla pagina operativa corrispondente, pre-compilando il numero polizza come parametro query (es. `/portafoglio/sospensione?polizza=ITCGNC35122`).

L'annullamento resta inline con dialog di conferma, perché è un'azione terminale.

Per le polizze **storico**, la card resta nascosta (logica già implementata).

### File coinvolti
- `src/pages/TitoloDetail.tsx` — sostituire card "Cambia Stato" con card "Operazioni" e pulsanti navigazione

