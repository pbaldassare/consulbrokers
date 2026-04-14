

## Piano: Collegare le operazioni alla polizza corrente

### Problema
Quando si clicca un'operazione (Sospensione, Riattivazione, ecc.) dal dettaglio polizza, la navigazione passa solo il `numero_titolo` come query param. Le pagine operative ignorano completamente i query params e richiedono di cercare manualmente cliente e polizza da zero.

### Soluzione
Passare dal dettaglio titolo tutti i dati necessari via query params (`polizza`, `riga`, `clienteId`, `titolo_id`) e fare in modo che ogni pagina operativa li legga con `useSearchParams` per pre-compilare i campi e caricare automaticamente i dati del cliente.

### Modifiche

**1. `TitoloDetail.tsx`** — Arricchire i query params nei pulsanti operazione
Invece di passare solo `polizza=NUMERO`, passare anche `riga`, `clienteId` (da `cliente_anagrafica`), e `titoloId`:
```
/portafoglio/sospensione?polizza=ITCGNC35122&riga=0&clienteId=UUID&titoloId=UUID
```

**2. `SospensionePolizzaPage.tsx`** — Leggere searchParams
- Importare `useSearchParams`
- Inizializzare `numeroPolizza`, `riga` dai params
- Se `clienteId` presente, fare fetch diretto del cliente e pre-compilare i campi
- Disabilitare i campi pre-compilati (readonly) quando si arriva dal dettaglio

**3. `RiattivazionePolizzaPage.tsx`** — Stesso pattern
- Pre-compilare `numeroDaRiatt`, `rigaDaRiatt` e cliente

**4. `DuplicazionePolizzaPage.tsx`** — Stesso pattern
- Pre-compilare `numeroPolizza`, `riga` e cliente

**5. `AppendiciPolizzaPage.tsx`** — Stesso pattern
- Pre-compilare `numeroPolizza`, `riga` e cliente

**6. `StornoPolizzaPage.tsx`** — Stesso pattern
- Pre-compilare `numeroPolizza`, `riga` e cliente

### File coinvolti (6 file)
- `src/pages/TitoloDetail.tsx` — query params arricchiti
- `src/pages/SospensionePolizzaPage.tsx` — lettura params + pre-fill
- `src/pages/RiattivazionePolizzaPage.tsx` — lettura params + pre-fill
- `src/pages/DuplicazionePolizzaPage.tsx` — lettura params + pre-fill
- `src/pages/AppendiciPolizzaPage.tsx` — lettura params + pre-fill
- `src/pages/StornoPolizzaPage.tsx` — lettura params + pre-fill

