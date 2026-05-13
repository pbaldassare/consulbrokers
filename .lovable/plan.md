# Unificazione entry point "Nuovo Cliente" e "Nuova Polizza"

## Stato attuale (mappatura)

### Nuovo Cliente — 3 implementazioni diverse
1. **`src/pages/ClientiList.tsx`** (linee 535–~1050): dialog inline **proprio**, ~500 righe di form duplicato (stati `nome`, `cognome`, `codiceFiscale`, `gruppoFinanziarioId`, scanner AI, tabs privato/azienda/ente, ecc.).
2. **`src/components/clienti/NuovoClienteDialog.tsx`**: il componente "ufficiale" riutilizzabile (~1052 righe), già usato da:
   - `ImmissionePolizzaPage.tsx` (creazione contestuale dalla nuova polizza)
   - `ImportNuovaPolizzaAIDialog.tsx` (creazione da import AI)

→ **Doppione**: il form di `ClientiList` reimplementa quello che fa già `NuovoClienteDialog`.

### Nuova Polizza — già quasi unificato
Tutti i punti puntano a `/portafoglio/immissione` (con `?clienteId=` quando contestuale):
- `PortafoglioAttivePage.tsx`, `PortafoglioStoricoPage.tsx`, `PortafoglioCaricoPage.tsx` → `navigate("/portafoglio/immissione")`
- `ClienteDetail.tsx` → `navigate("/portafoglio/immissione?clienteId=...")`
- `GestionePolizzePage.tsx` → action card che naviga a `/portafoglio/immissione`

→ Già coerente, **nessun doppione**.

## Obiettivo

Un solo componente per creare un cliente, un solo URL per creare una polizza.

## Modifiche

### 1. `src/pages/ClientiList.tsx` — sostituire il dialog inline con `NuovoClienteDialog`

- Rimuovere tutti gli stati locali del form (`nome`, `cognome`, `codiceFiscale`, `gruppoFinanziarioId`, `tipoCliente`, scanner AI, ecc.) e l'intero `<Dialog>` inline (linee ~535–~1050).
- Sostituire con:
  ```tsx
  <NuovoClienteDialog
    trigger={<Button><Plus className="w-4 h-4 mr-2" />Nuovo Cliente</Button>}
    onCreated={(nuovoId) => {
      refetch(); // refresh elenco clienti
      navigate(`/clienti/${nuovoId}`); // (opzionale) redirect al dettaglio
    }}
  />
  ```
- Rimuovere import non più usati (scanner AI, tabs, query gruppi finanziari, ecc.) se non servono altrove nella pagina.
- Comportamento atteso: identico (oggi il dialog inline fa le stesse cose), ma con un solo sorgente di verità.

### 2. `src/pages/ImmissionePolizzaPage.tsx` — già a posto
Continua a usare `NuovoClienteDialog` con prefill da AI. Nessuna modifica.

### 3. Nuova Polizza — nessuna modifica
Tutti i bottoni già convergono su `/portafoglio/immissione`. Confermato.

## Fuori scope

- Nessuna modifica a `NuovoClienteDialog` (logica interna invariata).
- Nessuna modifica al backend / schema DB.
- Nessuna modifica all'AI Import / matching cliente esistente (già fatto nei turn precedenti).
- Nessun refactor del form di `ImmissionePolizzaPage`.

## Risultato

- **1 componente** per creare clienti: `NuovoClienteDialog` (usato in `ClientiList`, `ImmissionePolizzaPage`, `ImportNuovaPolizzaAIDialog`).
- **1 route** per creare polizze: `/portafoglio/immissione[?clienteId=...]`.
- ~500 righe di codice duplicato rimosse da `ClientiList.tsx`.
