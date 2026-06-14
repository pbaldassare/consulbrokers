# Done

- **Lordo digitabile a mano**: `PremiGaranziaCardShell` ora usa un draft locale (`lordoDrafts`) per la cella Lordo. Durante la digitazione mostra la stringa esatta; al `blur` normalizza e fa partire il back-solve.
- **Auto-sync Firma → Quietanza** in `ImmissionePolizzaPage`: ogni edit della Firma rispecchia la Quietanza tramite `syncQuietanzaFromFirma`; gli edit manuali in Quietanza la marcano "personalizzata" via `markQuietanzaEdits`. Pulsante "Sincronizza da Firma" disabilitato se già sincronizzata.
