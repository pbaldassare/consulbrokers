/**
 * Selettori Playwright con etichette UI italiane (Consulnet/CBnet).
 * Centralizza i testo/role usati nelle suite e2e.
 */
export const SEL = {
  login: {
    email: '#email',
    password: '#password',
    submit: 'button[type="submit"]',
  },
  nav: {
    esci: 'Esci',
    cerca: 'CERCA',
  },
  clienti: {
    searchPlaceholder: 'Cerca per nome, CF, P.IVA...',
    nuovoCliente: 'Nuovo Cliente',
    nessunCliente: 'Nessun cliente trovato',
  },
  titoli: {
    searchPlaceholder: 'Numero polizza...',
    nessunRisultato: 'Nessun risultato trovato',
    incassa: /^Incassa$/,
    annullaIncasso: /Annulla Incasso|Annulla Messa a Cassa/i,
  },
  portafoglio: {
    caricoHeading: 'Avvisi di incasso',
    totaleTitoli: 'Totale titoli',
    resetFiltri: /Reset Filtri/i,
    immissioneHeading: /Immissione Polizza/i,
    conferma: /^Conferma$/,
  },
  contabilita: {
    cruscottoHeading: /cruscotto/i,
    movBancariHeading: /Caricamento Movimenti Bancari/i,
    ricongiungimentoHeading: /Ricongiungimento Bancario/i,
    tabMonitor: /Monitor Real-time/i,
    tabDaRicongiungere: /Da Ricongiungere/i,
    tabStorico: /Storico/i,
    inserimentoManuale: /Inserimento manuale/i,
    salvaRicongiungimento: /Salva Ricongiungimento/i,
    mettiACassa: /Metti a Cassa/i,
    anticipiHeading: /Riepilogo Acconti|Anticipi/i,
  },
  messaCassa: {
    dialog: /Conferma Messa a Cassa/i,
    confermaIncasso: /Conferma Incasso/i,
    annulla: 'Annulla',
    annullamentoDialog: /Conferma Annullamento Incasso/i,
    confermaAnnullamento: /Conferma Annullamento/i,
  },
  clientePortale: {
    benvenuto: /Benvenuto nella tua Area Clienti/i,
    polizze: /Polizze/i,
  },
} as const;
