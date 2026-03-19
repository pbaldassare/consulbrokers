

## Piano: Componente Filtri Estrazioni + Riscrittura Pagine Estrazione

### Obiettivo
Ricreare le 5 pagine di estrazione con un sistema di filtri avanzato ispirato al progetto zbenergy: filtri per periodo (data da/a), ufficio, produttore (Account Executive), compagnia, cliente, con pulsante "Azzera" e export CSV/Excel.

### Cosa faremo

#### 1. Creare componente riutilizzabile `EstrazioniFilters`
**File**: `src/components/estrazioni/EstrazioniFilters.tsx`

Componente filtri condiviso da tutte le pagine di estrazione, ispirato a `ReportsFilters` di zbenergy:
- **Periodo**: Select con "Questo mese", "Ultimi 3 mesi", "Ultimi 6 mesi", "Quest'anno", "Tutto", "Personalizzato"
- **Date personalizzate**: Calendar popover per data inizio/fine (visibili solo quando periodo = "Personalizzato")
- **Ufficio**: Select con lista da tabella `uffici`
- **Produttore (A/E)**: Select con ricerca, carica da `profiles` dove `ruolo = produttore` (o tutti i profili con ruolo rilevante)
- **Compagnia**: Select con ricerca, carica da tabella `compagnie`
- **Cliente**: Input con ricerca, carica da tabella `clienti`
- **Provvigioni SI/NO**: Radio toggle (solo per pagine che lo richiedono)
- **Pulsante Azzera**: reset di tutti i filtri
- Layout a griglia wrap responsive, con icona Filter + etichetta "Filtri:"

L'interfaccia `FiltersState` sara':
```typescript
interface EstrazioniFiltersState {
  period: string;
  customStartDate: Date | null;
  customEndDate: Date | null;
  ufficio_id: string | null;
  produttore_id: string | null;
  compagnia_id: string | null;
  cliente_id: string | null;
  conProvvigioni: boolean | null;
}
```

Ogni pagina potra' decidere quali filtri mostrare tramite props booleane (`showCompagnia`, `showProduttore`, `showCliente`, `showProvvigioni`).

#### 2. Riscrivere le 5 pagine di estrazione

Tutte useranno `EstrazioniFilters` e passeranno i filtri alla query Supabase. Struttura comune: header con back button + titolo, filtri, tabella con totali in footer, export CSV.

Le query filtreranno `titoli` per:
- `data_incasso` nel range date selezionate
- `ufficio_id` se filtro attivo
- `produttore_id` se filtro attivo  
- join `prodotti` → `compagnie` per filtro compagnia
- `cliente_anagrafica_id` per filtro cliente

**a) PortafoglioPerClientePage** — aggiunge filtri ufficio, produttore, compagnia, periodo
**b) PortafoglioPerCompagniaPage** — aggiunge filtri ufficio, produttore, periodo
**c) PremiProvvigioniPage** — aggiunge filtri ufficio, produttore, compagnia, periodo, provvigioni SI/NO
**d) PremiScopertiGarantitiPage** — aggiunge filtri ufficio, compagnia, periodo
**e) ECClientiPage** — aggiunge filtri ufficio, periodo, cliente

#### 3. Helper `getDateRange`
Funzione utility nel componente filtri che converte il periodo selezionato in date da/a (come in zbenergy).

### File coinvolti

| Azione | File |
|--------|------|
| Creare | `src/components/estrazioni/EstrazioniFilters.tsx` |
| Riscrivere | `src/pages/estrazioni/PortafoglioPerClientePage.tsx` |
| Riscrivere | `src/pages/estrazioni/PortafoglioPerCompagniaPage.tsx` |
| Riscrivere | `src/pages/estrazioni/PremiProvvigioniPage.tsx` |
| Riscrivere | `src/pages/estrazioni/PremiScopertiGarantitiPage.tsx` |
| Riscrivere | `src/pages/estrazioni/ECClientiPage.tsx` |

Nessuna migration necessaria — tutte le tabelle e colonne (uffici, compagnie, produttore_id, data_incasso) esistono gia'.

