/** Selettori UI italiani per la suite e2e canonica. */
export const SEL = {
  portafoglio: {
    caricoHeading: 'Incassi',
    totaleTitoli: 'Totale titoli',
    resetFiltri: /Reset Filtri/i,
    quietanze: 'Quietanze',
    inAttesaRinnovo: 'In attesa rinnovo',
  },
  contabilita: {
    incassiHeading: /Riepilogo Messe a Cassa/i,
    movBancariHeading: /Caricamento Movimenti Bancari/i,
    ricongiungimentoHeading: /Storico bonifici|Bonifici \(legacy\)/i,
    tabDaRicongiungere: /Da collegare/i,
    tabStorico: /Storico/i,
    tabImportazione: /Importazione/i,
    tabMonitor: /Monitor Real-time/i,
  },
  clienti: {
    searchPlaceholder: 'Cerca per nome, CF, P.IVA...',
    nuovoCliente: 'Nuovo Cliente',
  },
  sinistri: {
    nuovoSinistro: 'Nuovo Sinistro',
    searchPlaceholder: 'Cerca per numero, descrizione...',
  },
  documenti: {
    caricaDocumento: 'Carica Documento',
    libreriaCga: 'Libreria CGA',
    archivioDocumentale: /Archivio Documentale|documentale/i,
  },
} as const;
