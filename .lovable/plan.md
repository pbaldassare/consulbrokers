

## Piano: Provvigioni nel Modale Compagnia

### Cosa cambia

Spostare la gestione provvigioni per ramo **dentro il modale di modifica/creazione compagnia** come terzo tab "Provvigioni", accanto a "Dati Anagrafici" e "Dati Contabili". Rimuovere la sezione "Provvigioni per Ramo" dal tab principale "Prodotti & Provvigioni".

### Modifiche in `src/pages/CompagnieList.tsx`

**1. `CompagniaFormDialog` — aggiungere tab "Provvigioni"**
- Il componente riceve un nuovo prop `compagniaId` (valorizzato solo in modifica, null in creazione)
- TabsList passa da `grid-cols-2` a `grid-cols-3`, aggiungendo `<TabsTrigger value="provvigioni">Provvigioni</TabsTrigger>`
- Nuovo `<TabsContent value="provvigioni">`:
  - Query `provvigioni_compagnia_ramo` filtrata per `compagnia_id = compagniaId`
  - Tabella con colonne: Ramo, Provvigione %
  - Inline edit della percentuale (stesso pattern già usato)
  - Bottone "Nuova Provvigione Ramo" con mini-form: selezione categoria + percentuale
  - Se `compagniaId` è null (creazione), mostra messaggio "Salva la compagnia prima di configurare le provvigioni"

**2. `ProdottiProvvigioniTab` — rimuovere sezione provvigioni**
- Eliminare tutta la Card "Provvigioni per Ramo" (righe ~588-699)
- Eliminare gli state e le mutation relative (`createProvvRamoOpen`, `newProvvRamo`, `editingProvvRamo`, `filterProvvCompagnia`, `createProvvRamoMutation`, `updateProvvRamoMutation`, query `provvigioni_compagnia_ramo`)
- Resta solo il Catalogo Prodotti

**3. Passare `compagniaId` al dialog**
- Nel dialog di modifica: `compagniaId={editId}`
- Nel dialog di creazione: `compagniaId={null}`

### Nessuna modifica al DB
Stesse tabelle, stesse RLS. Cambia solo il punto di accesso UI.

