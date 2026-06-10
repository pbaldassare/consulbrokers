## Anticipi come chip nella tab bar

### Modifiche

**1. Nuovo `src/components/clienti/AnticipiChip.tsx`**
- Pulsante compatto altezza `h-9` (stessa altezza `TabsTrigger`): icona Wallet + label "Anticipi" + Badge con totale `€X,XX`.
- Click → apre `Dialog` (`sm:max-w-2xl`) con:
  - header totale disponibile + bottone "+ Nuovo Anticipo"
  - tabella zebra anticipi attivi (Data, Conto, Importo, Residuo, Stato, elimina)
  - `<details>` collassabile con storico esauriti
- Riusa `NuovoAnticipoDialog`, `AnticipoUtilizziDrawer`, hook `useAnticipiCliente`.

**2. `src/pages/ClienteDetail.tsx`**
- Rimuovo `<AnticipiCard clienteId={id!} />` (righe 1869-1870) inserita sotto l'header.
- Inserisco `<AnticipiChip clienteId={id!} />` nella `TabsList`, subito dopo il `TabsTrigger value="sinistri"` (riga 1885).

**3. `AnticipiCard.tsx`** — resta nel repo ma non più usata (nessun import). Può essere rimossa in seguito.

### Risultato visivo

```text
[Anagrafica] [Polizze · Quietanze] [⚠ Sinistri] [💰 Anticipi · 0,00 €] [Aziende] [...]
                                                       │
                                                       └── click → Dialog (totale + tabella + Nuovo)
```
