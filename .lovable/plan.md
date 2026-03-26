

## Piano: Rimuovere il Catalogo Prodotti

### Cosa cambia

Eliminare completamente il tab "Prodotti & Provvigioni" dalla pagina Compagnie, che ora contiene solo il Catalogo Prodotti (le provvigioni sono gia state spostate nel modale). La pagina restera con i soli tab "Compagnie / Sedi" e "Ufficio Sinistri".

### Modifiche in `src/pages/CompagnieList.tsx`

**1. Rimuovere il componente `ProdottiProvvigioniTab`** (righe ~600-815)
- Eliminare l'intero componente e tutti i suoi state, query e mutation (prodotti, categorie, filtri, creazione prodotto)

**2. Rimuovere il tab "Prodotti" dalla pagina principale**
- Eliminare `<TabsTrigger value="prodotti">` e `<TabsContent value="prodotti">` (righe ~1079-1081)
- Aggiornare `TabsList` da `grid-cols-3` a `grid-cols-2` (o rimuovere la griglia se ora sono solo 2 tab)

**3. Pulizia import**
- Rimuovere eventuali import non piu usati (es. `Package` da lucide-react se usato solo li)

Nessuna modifica al DB. Il tab Prodotti viene semplicemente rimosso dall'interfaccia.

