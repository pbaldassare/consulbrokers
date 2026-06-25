/** Selettori UI italiani per la suite e2e canonica. */
export const SEL = {
  portafoglio: {
    caricoHeading: 'Carico',
    totaleTitoli: 'Totale titoli',
    resetFiltri: /Reset Filtri/i,
    quietanze: 'Quietanze',
    inAttesaRinnovo: 'In attesa rinnovo',
  },
  contabilita: {
    incassiHeading: /Incassi e Coperture/i,
    movBancariHeading: /Caricamento Movimenti Bancari/i,
    ricongiungimentoHeading: /Ricongiungimento Bancario/i,
    tabDaRicongiungere: /Da Ricongiungere/i,
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
    analizzaCga: 'Analizza Polizza CGA',
    polizzeAnalizzate: /Polizze Analizzate \(CGA\)/i,
    libreriaCga: 'Libreria CGA',
    archivioDocumentale: /Archivio Documentale|documentale/i,
  },
} as const;
