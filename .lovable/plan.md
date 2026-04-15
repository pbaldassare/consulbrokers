

## Piano: Nascondere la pagina Quadratura Premi

### Cosa cambia
La pagina "Quadratura Premi" viene rimossa dalla sidebar e dalle route, ma il file sorgente resta nel repo.

### Modifiche

**1. `src/components/AppSidebar.tsx`**
- Rimuovere la voce `{ label: "Quadratura Premi", path: "/contabilita/quadratura-premi", icon: Search }` dall'array dei sotto-menu Contabilità

**2. `src/routes/contabilita.tsx`**
- Commentare o rimuovere la Route `<Route path="/contabilita/quadratura-premi" element={<QuadraturePremi />} />`

I file sorgente (`QuadraturePremi.tsx`) restano nel repo per eventuale riattivazione futura.

