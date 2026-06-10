## Obiettivo
Nel dialog "Conferma Messa a Cassa" su `TitoloDetail` il campo **Banca** mostra l'elenco hardcoded di tutte le banche italiane (`bancheItaliane`). Va sostituito con la sola lista dei conti bancari Consulbrokers (tabella `conti_bancari` con `tipo = 'generico'`), coerentemente con il `MessaCassaDialog` del Portafoglio e con la regola già in memoria per "Paga Rimessa".

## Modifiche

### `src/pages/TitoloDetail.tsx`
1. Importare `ContoBancarioSelect` da `@/components/anagrafiche/ContoBancarioSelect`.
2. Sostituire (righe ~1848-1858) il blocco `<Select>` hardcoded con:
   ```tsx
   {cassaForm.tipoPagamento === "bonifico" && (
     <div>
       <Label className="text-xs">Conto Consulbrokers</Label>
       <ContoBancarioSelect
         tipi={["generico"]}
         value={cassaForm.banca || null}
         onChange={(id) => setCassaForm(f => ({ ...f, banca: id || "" }))}
         placeholder="Seleziona conto..."
         showPreview
         className="mt-1"
       />
     </div>
   )}
   ```
3. In `changeStatoMutation` (riga ~1277), `cassaForm.banca` ora è l'`id` del conto, non una stringa. Prima di salvare risolvere l'etichetta:
   ```ts
   if (cassaData.tipoPagamento === "bonifico" && cassaData.banca) {
     const { data: conto } = await (supabase.from("conti_bancari") as any)
       .select("etichetta, banca").eq("id", cassaData.banca).maybeSingle();
     updatePayload.banca_pagamento = conto?.etichetta || conto?.banca || null;
   }
   ```
4. Rimuovere (o lasciare se usato altrove — da verificare) l'array `bancheItaliane` se non più referenziato.

## Note
- Stesso dialog del `MessaCassaDialog` del Portafoglio: comportamento allineato.
- Nessuna migrazione DB: `banca_pagamento` resta `text` con l'etichetta del conto.
- Coerente con memory `rimessa-mittente-napoli` (select conti Consulbrokers `tipo='generico'`).
