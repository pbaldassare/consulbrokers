## Pulsante "Azzera" nella sezione Contratto

Aggiungere un piccolo pulsante **Azzera** nell'header della sezione *Contratto* di `src/pages/ImmissionePolizzaPage.tsx` che resetta le due select:

- **Compagnia Assicurativa** (`selectedGruppoCompagniaId`)
- **Agenzia di Riferimento** (`selectedCompagnia`)
- e per coerenza il **rapporto** collegato (`selectedRapportoId`), che dipende da entrambe.

### Implementazione

`PolizzaSection` espone già lo slot `headerExtra` (a destra del titolo, prima della chevron). Lo useremo così:

```tsx
<PolizzaSection
  title="Contratto"
  icon={FileText}
  headerExtra={
    (selectedGruppoCompagniaId || selectedCompagnia || selectedRapportoId) && (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-teal-700 hover:text-teal-900 hover:bg-teal-100"
        onClick={(e) => {
          e.stopPropagation(); // evita di togglare il collapsible
          setSelectedGruppoCompagniaId("");
          setSelectedCompagnia("");
          setSelectedRapportoId("");
        }}
      >
        <X className="w-3.5 h-3.5 mr-1" /> Azzera
      </Button>
    )
  }
>
```

- `stopPropagation` necessario perché l'header di `PolizzaSection` è anche il trigger del collapsible.
- Il pulsante è visibile solo quando almeno una delle tre select è valorizzata (evita rumore visivo a form vuoto).
- Nessuna modifica a `PolizzaSection`, ai dati o ad altre sezioni.

### Verifica
- Selezionare Compagnia + Agenzia → appare il pulsante → click → entrambe le select tornano vuote, il Ramo/Sottoramo a valle resta com'è (l'utente potrà riselezionare), e la sezione **non** si chiude.
