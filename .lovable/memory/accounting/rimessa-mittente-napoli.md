---
name: Rimessa mittente Napoli
description: PDF E/C Agenzia con sede Napoli forzata; popup Paga Rimessa con select conti Consulbrokers tipo 'generico'
type: feature
---

Tutti i pagamenti di rimessa partono dalla **Sede di Napoli**.

- `ECAgenziaPdfPage`: la sede mittente del PDF è precaricata cercando l'ufficio Napoli (`nome_ufficio ILIKE '%napoli%' OR citta ILIKE '%napoli%'`), non più dalla sede dell'utente loggato. L'utente può comunque sovrascrivere dal dropdown "Tutte le sedi".
- `ECCompagniaContabPage` → dialog "Paga Rimessa": è obbligatorio selezionare il **conto corrente Consulbrokers mittente** da `conti_bancari` filtrati per `tipo = 'generico'` e `attivo = true`. L'IBAN selezionato è quello inviato all'edge function `gestione-rimessa` come `iban_utilizzato`. L'IBAN della compagnia/agenzia resta come campo "destinazione" informativo.
