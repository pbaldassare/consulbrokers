## Problema

In `Immissione Polizza` (`/portafoglio/immissione`), il pulsante "Nuovo Cliente" apre `QuickClienteDialog` — un form ridotto che NON rispecchia il flusso normale di creazione cliente. Mancano:

- Gruppo Finanziario in cima (con derivazione automatica del Tipo Cliente)
- Codice CUP obbligatorio per Ente
- Validazione/auto-fill CF (sesso, nascita, luogo via `parseCF`)
- Sync 11-cifre CF → P.IVA
- Forma giuridica, SDI, indirizzi, dati statistici, ecc.

Inoltre i tab Privato/Azienda/Ente sono manualmente selezionabili invece di essere derivati dal Gruppo Finanziario (regola già fissata in memory).

## Soluzione

Riusare lo **stesso identico modal** già presente in `ClientiList.tsx` (righe 614→1071) anche dentro `ImmissionePolizzaPage`, in modo che ci sia un'unica esperienza di creazione cliente in tutta l'app.

### Approccio: estrazione in componente condiviso

1. **Estrarre** il contenuto del modal "Nuovo Cliente" da `src/pages/ClientiList.tsx` in un nuovo componente riutilizzabile `src/components/clienti/NuovoClienteDialog.tsx` con interfaccia:
   ```ts
   interface NuovoClienteDialogProps {
     trigger?: React.ReactNode;          // bottone custom (default: "Nuovo Cliente")
     onCreated?: (clienteId: string, label: string) => void;  // callback opzionale
     open?: boolean;                     // controllo esterno opzionale
     onOpenChange?: (o: boolean) => void;
   }
   ```
   Il componente incapsula tutto lo stato (gruppo finanziario, tipo derivato, anagrafica, indirizzi, dati statistici, ruoli commerciali, ecc.) e l'insert su `clienti`.

2. **Refactor `ClientiList.tsx`**: rimuovere il blocco inline e usare `<NuovoClienteDialog onCreated={...} />`. Comportamento invariato.

3. **Refactor `ImmissionePolizzaPage.tsx`**:
   - Rimuovere import e uso di `QuickClienteDialog`.
   - Inserire `<NuovoClienteDialog onCreated={(id, label) => { /* seleziona il cliente appena creato nel form polizza */ }} trigger={<Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"><UserPlus className="w-3.5 h-3.5"/>Nuovo Cliente</Button>} />` al posto del dialog attuale.
   - Il callback `onCreated` aggiorna il SearchableSelect "Cliente" con il cliente appena creato (stesso comportamento attuale di `QuickClienteDialog`).

4. **Deprecare `QuickClienteDialog`**:
   - Verificare con `rg "QuickClienteDialog"` se è usato altrove. Se solo in Immissione Polizza, eliminare il file `src/components/polizze/QuickClienteDialog.tsx`. Altrimenti aggiornare anche gli altri usi.

## File coinvolti

- **Nuovo**: `src/components/clienti/NuovoClienteDialog.tsx`
- **Modificati**: `src/pages/ClientiList.tsx`, `src/pages/ImmissionePolizzaPage.tsx`
- **Eliminato** (se non più usato): `src/components/polizze/QuickClienteDialog.tsx`
- **Memory update**: aggiornare `mem://insurance/gruppi-finanziari-tipo-soggetto.md` per chiarire che il modal completo è ora un componente condiviso `NuovoClienteDialog` usato sia in Anagrafica Clienti sia in Immissione Polizza.

## Risultato atteso

Cliccando "Nuovo Cliente" da Immissione Polizza si apre lo stesso modal grande (max-w-3xl, scrollabile) di Anagrafica Clienti, con Gruppo Finanziario in cima, badge Tipo Cliente auto-derivato, CUP per Ente, validazione CF, ecc. Una volta creato, il cliente viene selezionato automaticamente nel form polizza.
