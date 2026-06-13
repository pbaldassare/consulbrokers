## Problema

Nel portale cliente (`/cliente/sinistri`), il dialog "Apri nuovo sinistro" mostra il dropdown **"Polizza coinvolta" vuoto** per il Comune di Varese, anche se il cliente ha 10 polizze attive.

## Causa diagnosticata

Verifiche sul DB:
- `clienti` "Comune di Varese" (`94dc5a3c…`) → **0 titoli** linkati (`titoli.cliente_anagrafica_id`)
- Stessa anagrafica → **10 record in `polizza_cga`** stato `approvato`
- Policy RLS attuale su `polizza_cga`:
  ```
  polizza_cga_read_via_cliente:
    has_role(admin) OR has_role(cfo)
    OR (profilo.ufficio_id = clienti.ufficio_id)
  ```
  → il ruolo **`cliente` non ha accesso** alle proprie `polizza_cga`. Il dialog le carica con `.in("cliente_id", ids)`, ma RLS le filtra a 0.

Il dialog (`NuovaDenunciaSinistroDialog.tsx`) è già scritto correttamente per supportare le polizze CGA (prefix `cga:`), quindi il fix è solo lato policy.

## Piano

### 1. Migrazione SQL — estendere RLS `polizza_cga`
Aggiungere ramo "cliente legge proprie polizze" alla policy SELECT, mantenendo i rami esistenti:

```sql
DROP POLICY polizza_cga_read_via_cliente ON public.polizza_cga;
CREATE POLICY polizza_cga_read_via_cliente ON public.polizza_cga
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'cfo')
  OR EXISTS (
    SELECT 1 FROM clienti c
    JOIN profiles p ON p.id = auth.uid()
    WHERE c.id = polizza_cga.cliente_id
      AND p.ufficio_id IS NOT NULL
      AND c.ufficio_id = p.ufficio_id
  )
  OR cliente_id IN (SELECT public.get_my_cliente_ids())  -- NEW: cliente owner
);
```

Stesso pattern anche per `polizza_cga_premio_garanzia` e `polizza_garanzie_personali` (se esposte al cliente — verifico nella migrazione e includo solo se servono per il rendering della polizza nel portale).

`prodotti_cga` è già leggibile da tutti gli authenticated → OK, il join `prodotti_cga(ramo)` funzionerà.

### 2. Verifica
- Aprire `/cliente/sinistri` come utente Varese → dialog "Apri nuovo sinistro" → dropdown popolato con le 10 polizze CGA (con numero polizza e ramo).
- Selezionare polizza CGA e inviare denuncia → sinistro creato con `titolo_id = null` (corretto, è CGA), `cliente_anagrafica_id` valorizzato.
- Confermare che il sinistro appare nella lista `/cliente/sinistri`.

### 3. Fuori scope
- Nessuna modifica al frontend: la mapping `cga:` è già implementata.
- Nessun nuovo campo `polizza_cga_id` su `sinistri` (le polizze CGA sono assicurazioni pre-vendita, il link "soft" tramite numero polizza in descrizione/note è sufficiente per ora).
- I sinistri esistenti del Comune di Varese hanno tutti `titolo_id = null`: è coerente perché non esistono titoli per Varese.

## Note tecniche

- `get_my_cliente_ids()` è `SECURITY DEFINER`, già usata in altre policy cliente — pattern consolidato.
- La migrazione mantiene completa retro-compatibilità: aggiunge un OR, non rimuove condizioni esistenti.
