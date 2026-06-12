Aggiorno la lista dei tipi sinistro e l'input "Luogo accadimento" sia nel wizard admin sia nel dialog cliente.

1. **Lista tipi sinistro unificata** in un nuovo file `src/lib/tipiSinistro.ts` con i 27 valori richiesti (slug + label IT), così è condivisa tra wizard e dialog cliente. Valori inclusi: atti_vandalici, atti_vandalici_auto, auto_guasti_kasko, auto_varie, cristalli, danno_acqua, danno_indiretto, difesa_legale, evento_naturale, fenomeno_elettrico, grandine, incendio, furto, infortunio_non_mortale, malattia, rc_professionale, rc_sanitaria, rca_danni_a_cose, rca_danni_a_persone, rct_danni_a_cose, rct_danni_a_persone_non_mortale, rct_danni_a_persone_mortale, rct_danni_a_persone_e_cose, rc_patrimoniale, rischio_montaggio, urto_veicolo_non_identificato. (La doppia voce "INCENDIO" nell'elenco è una ripetizione: tengo un solo "incendio".)

2. **`SinistroAperturaWizardPage.tsx`**:
   - sostituisco l'array `tipiSinistro`/`tipoLabels` con quelli importati;
   - sostituisco il `Select` nativo del tipo sinistro con un `SearchableSelect` (ricerca testuale);
   - sostituisco l'`Input` "Luogo accadimento" con `AddressAutocomplete` (Google Maps), salvando l'indirizzo completo in `luogo_sinistro`.

3. **`NuovaDenunciaSinistroDialog.tsx`** (portale cliente):
   - sostituisco l'array `TIPI_SINISTRO` con la lista unificata; mantengo il flag `isVeicolo` derivandolo dai prefissi (`auto_`, `rca_`, `cristalli`, `urto_veicolo_*`, `atti_vandalici_auto`);
   - sostituisco il `Select` tipo sinistro con `SearchableSelect`;
   - il campo indirizzo usa già `AddressAutocomplete`, lo lascio.

4. **Filtri/visualizzazione esistenti** in `SinistriList.tsx` e `SinistroDetail.tsx`: lascio i vecchi valori riconosciuti come fallback (label = slug) per non rompere i sinistri storici, ma il filtro dropdown userà la nuova lista.

Nessuna migrazione DB: `sinistri.tipo_sinistro` è `text` libero, accetta i nuovi slug senza modifiche.