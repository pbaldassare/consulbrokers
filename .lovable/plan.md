## Problema
Nella pagina **Ricongiungimento Bancario**, espandendo una riga (es. ARS RESTAURI DI TRIBBIA SRL, 647 €), la sezione "Polizze attive" mostra sempre "Nessuna polizza in carico per questo cliente.", anche quando il cliente ha polizze attive. Il DB conferma 1 polizza attiva non messa a cassa per questo cliente.

## Causa
La query in `RicongiungimentoBancarioPage.tsx` (`MovimentoCard`, ~ righe 115-128) ha due errori che la fanno fallire silenziosamente (Supabase restituisce errore, il codice ignora `error` e usa `[]`):

1. `.order("data_decorrenza", ...)` — la colonna non esiste su `titoli` (esistono `data_scadenza`, `data_incasso`, `data_messa_cassa`, ecc.).
2. `select("... ramo_label:rami(nome) ...")` — la tabella `rami` non ha la colonna `nome`, il campo corretto è `descrizione`.

Il render già usa `p.ramo_label?.nome`, quindi va allineato anche lì.

## Fix proposto
Solo correzioni puntuali nella query e nel render, nessun cambio di logica/DB:

1. **Query polizze attive** — sostituire l'order con un campo esistente (uso `data_scadenza` asc così le più urgenti compaiono per prime) e selezionare `descrizione` da `rami`:
   ```ts
   .select("id, numero_titolo, premio_lordo, stato, data_messa_cassa, ramo:rami(descrizione), compagnia:compagnie(nome)")
   .eq("cliente_anagrafica_id", movimento.cliente_id)
   .is("data_messa_cassa", null)
   .neq("stato", "annullato")
   .order("data_scadenza", { ascending: true, nullsFirst: false })
   .limit(50);
   ```
   Aggiungere anche gestione esplicita dell'errore (throw) per evitare futuri silent fail.

2. **Render** — usare `p.ramo?.descrizione` al posto di `p.ramo_label?.nome`.

## Verifica
- Riaprire la card del movimento ARS RESTAURI DI TRIBBIA SRL: deve comparire 1 polizza con numero, ramo (descrizione), compagnia e premio, selezionabile via checkbox per il ricongiungimento.
- Quadratura/Salva/Metti a Cassa restano invariati.

## File modificati
- `src/pages/contabilita/RicongiungimentoBancarioPage.tsx` (solo `MovimentoCard`: query `polizze-cliente` + cella Ramo della tabella).
