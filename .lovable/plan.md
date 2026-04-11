

## Piano: Aggiornare la API key di Browser Use

### Modifica

Aggiorno il secret `BROWSER_USE_API_KEY` con il nuovo valore `bu_z-V1NVlnhlmMdHGa1GDjMYz2tEFJEUJ0QauAyCaPXj0`.

Nessuna modifica al codice -- la Edge Function `cerca-bandi` già legge da `Deno.env.get('BROWSER_USE_API_KEY')`. Login e password MondoAppalti restano invariati.

