## Obiettivo
Replicare il flusso "E/C Agenzia" anche per i Clienti: pagina con anteprima PDF, modifica campi intestazione, scarica e salva (storico). Output identico al PDF allegato `EC_MARZIA.pdf`.

## Dati DB (verifica completata)
Tutti i campi del PDF sono coperti:
- Cliente (intestatario): `clienti` (ragione_sociale / cognome+nome, indirizzo, cap, comune, provincia)
- Sede mittente / footer: `uffici` (nome, indirizzo, città, telefono, email, **iban** per "per conto compagnie")
- Righe tabella: `titoli` + join `polizze`, `compagnie`, `rami`
  - polizza → `polizze.numero_polizza`
  - ramo → `rami.descrizione`
  - rischio → `polizze.prodotto_nome`
  - Compagnia → `compagnie.nome`
  - Effetto → `titoli.data_effetto`
  - Premio → `titoli.premio_lordo`
- Totale = somma premi
- Footer legale (Esente IVA art.10 / Esente bollo art.34) costante

## Cosa creare

1. **`src/lib/ec-cliente-pdf.ts`** (nuovo)
   - `buildECClientePdf(data: ECClienteData): Promise<Uint8Array>` con `pdf-lib`
   - Layout fedele al PDF: logo cbdigital (riusa quello già in `ec-agenzia-pdf` se presente, altrimenti aggiungiamo asset), intestazione destinatario, oggetto, tabella (polizza, ramo, rischio, Compagnia, Effetto, Premio), totale, blocco IBAN per conto compagnie, footer legale con dati Consulbrokers Digital srl.

2. **`src/pages/contabilita/ECClientePdfPage.tsx`** (nuovo, copia adattata di `ECAgenziaPdfPage.tsx`)
   - Query params: `clienteId`, `titoliIds` (CSV), opzionale `periodoDal/Al`
   - Carica cliente, sede mittente (da `profile.ufficio_id`), titoli con join
   - Form editabile: data documento, oggetto, modalità pagamento, IBAN, note
   - Pulsanti: **Anteprima**, **Scarica PDF**, **Salva** (storage `documenti-clienti` + record in tabella storico, riusando lo stesso schema di salvataggio dell'E/C Agenzia)
   - `PdfPreview` component identico

3. **Route** in `src/routes/contabilita.tsx`: `/contabilita/ec-cliente/pdf` → `ECClientePdfPage`

4. **Punto di ingresso**: aggiungere bottone "Genera E/C PDF" nella pagina `ECClientiPage` (riga cliente o azione bulk con selezione titoli) e/o nel dettaglio cliente. Conferma quale preferisci — di default lo metto sulla riga cliente in `ECClientiPage` (apre nuova tab con tutti i titoli del cliente nel periodo filtrato).

5. **Storico**: salvataggio analogo a E/C Agenzia (stessa tabella `documenti_generati` o equivalente già usata — verifico in fase di implementazione e riuso il pattern esatto).

## Note
- Nessuna modifica DB necessaria.
- IBAN di default da `uffici.iban` della sede mittente; editabile in form.
- Logo cbdigital: riuso lo stesso asset già caricato per E/C Agenzia.
