

## Piano: Ordinamento clienti per numero polizze

### Problema

La funzione RPC `count_polizze_per_cliente()` funziona correttamente — 2.886 clienti su 5.761 hanno polizze collegate. Il problema è che la lista è ordinata per `created_at DESC`, quindi i clienti più recenti (senza polizze) appaiono per primi. Tutti i conteggi mostrano "0" perché quei clienti specifici non hanno polizze.

### Interventi

**1. Ordinamento lato client con possibilità di scegliere**
- Dopo aver filtrato i clienti, ordinarli di default per numero di polizze decrescente
- Aggiungere un selettore di ordinamento (per polizze ↓, per cognome A-Z, per data creazione)
- L'ordinamento per polizze usa il dizionario `polizzeCounts` già disponibile

**2. Modifica in `ClientiList.tsx`**
- Aggiungere stato `sortBy` con opzioni: `"polizze"`, `"cognome"`, `"created_at"`
- Applicare il sort sulla lista `filtered` prima del render
- Aggiungere un `Select` nella barra filtri per scegliere l'ordinamento
- Default: ordinamento per numero polizze decrescente

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| File modificato | `src/pages/ClientiList.tsx` |
| Logica | Sort client-side su array `filtered` usando `polizzeCounts` map |
| Default | Ordinamento per polizze decrescente |
| Opzioni | Polizze ↓, Cognome A-Z, Data creazione ↓ |

