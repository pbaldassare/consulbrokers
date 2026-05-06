## Fix: nomi delle garanzie accessorie mancanti nella card "Composizione Premio RCA"

### Problema

Nella card *Composizione Premio RCA* (sia Firma che Quietanza), per le voci accessorie (ARD Incendio, ARD Furto, PAS Assistenza, Spese recupero, ARD Eventi socio-politici, ecc.) compaiono Premio Netto, Aliquota e Lordo ma **manca il nome del prodotto/garanzia**. Solo la riga RCA principale mostra l'etichetta.

### Causa

Il viewport del preview è 978px, quindi sotto la breakpoint `lg:` (1024px). Il componente `VociRcaCard.tsx` mostra:
- `hidden lg:block` → tabella desktop (con colonna "Voce" che funziona) → **nascosta**
- `lg:hidden` → cards mobile dove il titolo della voce viene renderizzato in un wrapper `flex-1 min-w-0` ma viene visivamente schiacciato dalla `truncate` interna combinata con il bottone azione, finendo per non mostrare il nome per le voci accessorie.

Inoltre la breakpoint `lg` è troppo alta: a 978px (laptop standard) andrebbe già usata la tabella completa.

### Fix proposto

In `src/components/polizze/VociRcaCard.tsx`:

1. **Abbassare la breakpoint** della tabella desktop da `lg:` (1024px) a `md:` (768px). Tabella più adatta a laptop/preview ≥768px.
   - Cambia `hidden lg:block` → `hidden md:block`
   - Cambia `lg:hidden` → `md:hidden`

2. **Sistemare il layout della card mobile** per garantire la visibilità del nome:
   - Spostare il nome della garanzia su una riga dedicata sopra la griglia campi, non più in flex con il bottone delete.
   - Bottone delete in alto a destra, posizionato in absolute o in flex separato.
   - Rimuovere `truncate` o usarlo con `break-words` per nomi lunghi tipo "ARD Eventi socio politici".

### File toccati

- `src/components/polizze/VociRcaCard.tsx` (solo presentazione, nessuna logica)

Nessuna modifica DB.
