

## Piano: Nascondere filtro compagnie e aggiungere ricerca nel dropdown rami

### Cosa cambia
1. **Rimuovere** il Select "Tutte le compagnie" (righe 134-144) e la relativa query lookup compagnie (righe 30-36) e lo stato `filtroCompagnia` (riga 21). Rimuovere anche i riferimenti a `filtroCompagnia` nelle query dati e totali.

2. **Aggiungere ricerca nel dropdown rami**: Sostituire il Select rami con un componente che supporti la ricerca testuale (tipo Combobox/Popover con Input + lista filtrata), così l'utente può digitare per trovare il ramo desiderato.

### File coinvolto
- `src/pages/PortafoglioAttivePage.tsx`
  - Eliminare stato `filtroCompagnia`, query `compagnie-lookup`, Select compagnie
  - Rimuovere `.eq("compagnia_id", filtroCompagnia)` dalle query dati e totali
  - Sostituire Select rami con Popover + Command (pattern già usato in altri componenti del progetto come `SearchableSelect`) per ricerca testuale

