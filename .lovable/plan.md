## Problema
In `ImmissionePolizzaPage` (Comune di Agnone) la Sede appare vuota e il Produttore non viene proposto, anche se il cliente in anagrafica ha `ufficio_id` valorizzato e assegnazioni AE/Backoffice. Solo l'AE e lo Specialist vengono ereditati visivamente.

Causa: la **bozza locale** (`loadDraft` sul `draftKey` per quel cliente) ripristina valori vuoti per `selectedUfficioId` / `selectedAE` / `selectedAccountExecutiveId` / `selectedBackofficeId`, sovrascrivendo l'eredità dal cliente quando la cache React Query del cliente è già calda al mount.

## Cosa fare

**File: `src/pages/ImmissionePolizzaPage.tsx`**

1. **Hydration bozza più morbida sui 4 campi "default-da-cliente"**  
   Nei setter applicati da `loadDraft` (riga ~453-475), per le chiavi `selectedUfficioId`, `selectedAE`, `selectedAccountExecutiveId`, `selectedBackofficeId` **non chiamare il setter se il valore della bozza è vuoto/null**. In questo modo la bozza non azzera l'eredità dal cliente: se l'utente li ha modificati sulla polizza, la bozza conterrà un id non vuoto e verrà ripristinato; se erano vuoti, vince il default dell'anagrafica.

2. **Eredità Sede dal cliente — riempi solo se vuoto, ma in modo robusto**  
   L'effect attuale (riga 699-703) imposta `selectedUfficioId` ogni volta che cambia `clienteDettaglio?.ufficio_id`. Cambiare a: imposta solo se `!selectedUfficioId`, così non sovrascrive eventuali scelte fatte dall'utente sulla polizza, e in combinazione col punto 1 garantisce che la Sede del cliente venga proposta come default.

3. **Eredità AE / Specialist / Produttore — già "fill-if-empty" ma rendiamo coerente**  
   Nell'effect riga 799-837 le tre assegnazioni Backoffice / AE / Produttore Sede vengono lette da `codici_commerciali_cliente`. Aggiungere la guardia `!selectedBackofficeId` prima di `setSelectedBackofficeId(bo.profilo_id)` (oggi è incondizionato) per uniformità con AE/Produttore, così rispetta override manuale già salvati in bozza.

4. **Nessuna nuova colonna DB, nessuna migration**: i default vivono già su `clienti.ufficio_id` e `codici_commerciali_cliente` (ruoli AE / Backoffice / Produttore Sede). La polizza continua a salvare il proprio valore su `titoli.ufficio_id`, `titoli.anagrafica_commerciale_id`, `titoli.ae_anagrafica_id`, `titoli.specialist` (già implementato).

## Comportamento atteso dopo la modifica

- Aprendo "Nuova polizza" da un cliente:
  - **Sede** → preimpostata da `clienti.ufficio_id` (es. Comune di Agnone → Sede Campobasso).
  - **Account Executive** → da `codici_commerciali_cliente.ruolo='AE'` (già funziona).
  - **Specialist** → da `codici_commerciali_cliente.ruolo='Backoffice'` (già funziona).
  - **Produttore** → da `codici_commerciali_cliente.ruolo='Produttore Sede'` se presente; altrimenti vuoto da scegliere (non c'è oggi per Comune di Agnone).
- L'utente può cambiare uno qualsiasi dei 4 campi sulla singola polizza; il valore scelto viene salvato sul titolo e ripristinato dalla bozza locale finché non si invia.
- Cancellando un campo e ricaricando la pagina, riappare il default dal cliente (non il vuoto della bozza).

## Fuori scope
- Non si tocca lo schema DB.
- Non si modifica la scheda cliente (i default si gestiscono già lì in "Dati commerciali").
- Nessun cambiamento al salvataggio della polizza.
