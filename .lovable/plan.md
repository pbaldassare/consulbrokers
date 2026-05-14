## Problema

Nel tab **Polizze** del cliente (`/archivi/clienti/:id`) compare sempre `Polizze (0)` anche quando il cliente ha titoli collegati (es. Paolo Baldassare ha 4 titoli con `cliente_anagrafica_id` corretto).

## Causa

In `src/pages/ClienteDetail.tsx` (riga 1193) la query usa una relazione inesistente:

```ts
.select("id, numero_titolo, stato, premio_lordo, importo_incassato, data_incasso, prodotti(nome_prodotto, agenzie(nome))")
```

PostgREST risponde **400** con:
```
Could not find a relationship between 'prodotti' and 'agenzie'... Perhaps you meant 'compagnie'.
```

I dati ci sono lato DB, è solo la query a fallire.

## Fix

Sostituire `agenzie(nome)` con `compagnie(nome)` nella select del tab Polizze cliente. Verificare che la cella della tabella che renderizza il nome agenzia legga il campo corretto (eventualmente aggiornare la chiave usata in JSX).

## Verifica

- Aprire `/archivi/clienti/0cfddc67-bffb-4685-a259-86bcd4261f5b` → tab **Polizze** mostra `Polizze (4)` con la lista dei titoli.
- Nessun 400 in network per `cliente_anagrafica_id=eq.0cfddc67…`.
