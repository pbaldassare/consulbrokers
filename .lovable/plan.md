## Obiettivo

Sulla scheda Cliente (`/archivi/clienti/:id`), tab **Polizze**, l'utente vuole poter creare una nuova polizza direttamente da qui — anche quando la lista è vuota, come nello screenshot ("Nessuna polizza collegata a questo cliente").

## Stato attuale

In `src/pages/ClienteDetail.tsx` il `<NuovaPolizzaButton clienteId={id} />` è già presente sia nell'header della card Polizze (riga 1544, `size="sm"`) sia nello stato vuoto (riga 1550, `variant="outline"`, label "Crea la prima polizza"). Nello screenshot però NON appaiono — probabilmente per cache/preview non aggiornato o per un problema di rendering nello stato vuoto.

## Intervento

1. **Rendere il CTA inequivocabile nello stato vuoto**: sostituire la `<div>` minimale con un blocco più visibile (icona + titolo "Nessuna polizza collegata" + sottotesto + bottone primario "Nuova Polizza" pieno, non outline). Così anche con cache vecchia il bottone è impossibile da non vedere.

2. **Header card Polizze**: mantenere il `NuovaPolizzaButton size="sm"` in alto a destra come scorciatoia, sempre presente (anche con polizze esistenti).

3. **Coerenza cross-soggetto**: replicare lo stesso pattern (header + empty state) sulle pagine analoghe per gli altri soggetti dove ha senso creare una polizza dal dettaglio:
   - `src/pages/ProspectDetail.tsx` — solo se il prospect è già convertibile/cliente (skip se non rilevante);
   - eventuali tab Polizze nelle schede Compagnia/Sede sono fuori scopo (la polizza nasce sempre dal cliente).

   Conferma rapida: lo applichiamo solo a Cliente e Prospect convertito, non a Compagnie/Sedi.

4. Nessuna modifica a `NuovaPolizzaButton` né alla logica di immissione: usa già `clienteId` querystring per pre-selezionare il cliente in `ImmissionePolizzaPage`.

## File toccati

```text
src/pages/ClienteDetail.tsx        (empty state restyle Polizze)
src/pages/ProspectDetail.tsx       (se presente tab Polizze, allineamento)
```

## Fuori scopo

- Permessi/RoleGuard sul bottone (oggi visibile a chiunque acceda al dettaglio cliente — invariato).
- Logica di creazione polizza (`ImmissionePolizzaPage`).
- Tab Polizze su Compagnia/Sede.