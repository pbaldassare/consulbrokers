## Rimozione sezione Pagamenti dal portale cliente

L'utente conferma che la voce "Pagamenti" nel portale cliente (`/cliente/pagamenti`) non serve. Va rimossa completamente.

### Modifiche

1. **`src/components/ClienteLayout.tsx`**
   - Rimuovere la voce `Pagamenti` (icona `CreditCard`) dall'array `allNavItems` della sidebar.

2. **`src/routes/cliente.tsx`**
   - Rimuovere la route `/cliente/pagamenti` e il relativo import di `ClientePagamenti`.

3. **`src/pages/cliente/ClientePagamenti.tsx`**
   - Eliminare il file (non più referenziato).

### Fuori scope
- Nessuna modifica al backend, alle tabelle o alle altre voci di menu.
- Nessuna modifica al portale interno o al portale prospect.