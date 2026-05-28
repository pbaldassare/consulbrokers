Due fix in `ImmissionePolizzaPage`:

1. Campo CIG per cliente Ente
   - Il cliente "Comune di Agnone" è già `tipo_soggetto = 'ente'` (gruppo finanziario "Azienda Partecipata Pubblica"), quindi `cigObbligatorio` deve risultare `true` e il campo CIG/Rif. + checkbox "CIG temporaneo" devono comparire nella sezione Contratto.
   - Verifica in build che il blocco CIG appaia effettivamente; se non appare, rendere più robusta la derivazione di `tipoSoggetto` leggendo anche `clienti.tipo_cliente = 'ente'` come fallback (oggi dipende solo dal join `gruppi_finanziari.tipo_soggetto`).
   - Rendere il blocco CIG visivamente più evidente quando obbligatorio (badge "Obbligatorio per Enti").

2. Spostare la Targa fuori dalla riga del N° Polizza
   - Rimuovere il campo "Targa/Telaio" inline che oggi compare accanto a "N° Polizza" quando `isRCA` (righe ~1822-1827).
   - Lasciare la targa SOLO nella sezione Veicolo (campo `vTarga` già presente) e nella sezione Conducente, dove serve.
   - Mantenere la sincronizzazione: il valore `targaTelaio` (campo legacy salvato in `titoli.targa_telaio`) viene allineato automaticamente a `vTarga` quando l'utente la digita in sezione Veicolo, così il salvataggio resta corretto senza UI duplicata.
   - La riga "N° Polizza" torna a tutta larghezza (rimuove la `grid-cols-5` quando non serve).