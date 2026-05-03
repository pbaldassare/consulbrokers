## Obiettivo
Aggiungere il documento **Precontrattuale** anche dal dettaglio della Polizza (Titolo), riutilizzando esattamente la stessa pagina/PDF già usata dal cliente, ma con **prefill aggiuntivo dei dati polizza** (numero, compagnia, ramo, riferimento).

## Cosa cambia per l'utente
- Sulla card **Operazioni** della pagina `/titoli/:id` compare un nuovo pulsante **Precontrattuale** (icona FileText).
- Cliccandolo si apre la stessa pagina `DocPrecontrattualePage` già esistente, con anteprima e salva PDF, ma con compilati automaticamente:
  - Tutti i dati Cliente + Sede + Specialist (come oggi quando si entra dal cliente)
  - **Numero polizza**, **Riferimento**, **Compagnia**, **Ramo** della polizza selezionata
- Stessa identica UI, stessa anteprima, stesso PDF (con blocco Sede Operativa già introdotto).

## Modifiche tecniche

### 1. `src/pages/TitoloDetail.tsx`
Aggiungere nella card Operazioni (dopo "Regolazione") un Button:
```tsx
<Button variant="outline" size="sm" onClick={() => navigate(
  `/portafoglio/doc-precontrattuale?titoloId=${t.id}&clienteId=${(t.cliente_anagrafica as any)?.id || ""}`
)}>
  <FileText className="w-4 h-4 mr-1" /> Precontrattuale
</Button>
```

### 2. `src/pages/DocPrecontrattualePage.tsx`
- Leggere nuovo query param `titoloId`.
- Aggiungere una `useQuery` che carica il titolo:
  - `titoli`: `numero_titolo, riferimento, ramo, prodotto_nome, compagnia_id, cliente_id`
  - join `compagnie`: `nome, codice`
- In un nuovo `useEffect([titoloData])`:
  - `setPolizza(t.numero_titolo)`
  - `setRiferimento(t.riferimento || "")`
  - `setRamo(t.ramo || "")`
  - `setCodiceCompagnia(compagnia.codice || compagnia.nome)` → triggera già la lookup esistente che popola `compagniaData.nome` usato nel PDF.
- Se `clienteId` non passato ma `titoloId` sì, derivarlo da `t.cliente_id` per riusare la logica di prefill cliente esistente.

### 3. `public/version.json`
Bump versione per refresh client.

## File toccati
- `src/pages/TitoloDetail.tsx` (1 bottone)
- `src/pages/DocPrecontrattualePage.tsx` (query + effect prefill polizza)
- `public/version.json`

Nessuna modifica a `precontrattuale-pdf.ts`: il PDF già supporta `polizzaNumero`, `polizzaRiferimento`, `polizzaCompagniaTesto`, `polizzaRamo`.