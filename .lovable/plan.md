

## Piano: Spostare le Tab in alto nella pagina ClienteDetail

### Cosa cambia

Le tab (Polizze, Aziende/Persone, Documenti, Chat, Timeline) attualmente si trovano in fondo alla pagina, dopo la card "Dati Anagrafici" e tutti gli Accordion. Verranno spostate subito dopo l'intestazione del cliente (nome, badge, pulsante Modifica), prima di qualsiasi altra sezione.

### Implementazione

**File: `src/pages/ClienteDetail.tsx`**

- Spostare il blocco `<Tabs>` (righe 632-fine) subito dopo la `div` dell'intestazione (riga 490)
- Le sezioni "Dati Anagrafici", Accordion (Gestionali, Statistici, Commerciali, Contabili) verranno incluse come contenuto di una delle tab oppure posizionate dopo le tab
- Layout risultante:
  1. Header (nome, badge, pulsante modifica)
  2. **TabsList** (Polizze, Aziende, Documenti, Chat, Timeline)
  3. **TabsContent** per ciascuna tab
  4. Le card anagrafiche e accordion restano visibili sotto le tab (fuori dal componente Tabs) oppure diventano una tab "Anagrafica"

### Dettagli tecnici

| Elemento | Dettaglio |
|---|---|
| File modificato | `src/pages/ClienteDetail.tsx` |
| Logica | Riordinamento JSX: spostare `<Tabs>` block dalla riga 632 alla riga 491 |

