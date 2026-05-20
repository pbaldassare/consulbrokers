## Fix
In `src/components/compagnie/RapportiCompagniaDialog.tsx`, `persistContoRapporto` (riga ~227), aggiungere `compagnia_id: compagniaId` al payload del conto bancario. Il trigger DB esige `compagnia_id` per `tipo='agenzia'`, e l'abbiamo già disponibile dalle props del dialog.

Nessuna migrazione: il vincolo DB è corretto (i conti di tipo agenzia/broker devono sapere a chi appartengono).