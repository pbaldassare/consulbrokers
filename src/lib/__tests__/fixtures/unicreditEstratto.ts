/**
 * Layout reale UniCredit «Movimenti»:
 * riga titolo Rapporto/IBAN, header spezzato su due righe (Data/Operaz. + EUR),
 * importi in colonna divisa, nessuna Avere/Dare.
 */
export const UNICREDIT_PREAMBLE_AOA: unknown[][] = [
  ["Data da: Rapporto IT 60 B 02008 36282 000101869818 - CONSULBROKERS S.P.A."],
  [],
  ["Data", "", "Descrizione", "EUR", "Caus."],
  ["Operaz.", "Valuta"],
  [
    46296,
    46296,
    "BONIFICO A VOSTRO FAVORE BONIFICO SEPA DA  SIMIONI MAURA PER  SIMIONI MAURA POLIZZA 408847349 TAR GA FN848BD TRN 1001262742001529",
    594.78,
    "048",
  ],
  [
    46296,
    46296,
    "BONIFICO A VOSTRO FAVORE BONIFICO SEPA DA  DARMAN IVANO E DEL ZENERO MICHELA PER  1.82.0207230 K24IT020113CG/25 TRN 1001262742030770",
    284.9,
    "048",
  ],
  [
    46300,
    46300,
    "BONIFICO A VOSTRO FAVORE BONIFICO SEPA DA  COMUNE DI SAN GIORGIO IN BOSCO PER  MAND. N. 1306- 1 CIG BD2E850F47 Pagamento della polizza TRN 1001262782024500",
    1343.01,
    "048",
  ],
  [
    46301,
    46301,
    "BONIFICO A VOSTRO FAVORE BONIFICO ISTANTANEO DEL 06.10.2026 ALLE 10.27.54 DA  Snezha Dinova PER  EMITTENDA- 02075 R. C. AUTO EA642MH TRN  1091262793646867",
    690.09,
    "048",
  ],
];

export const UNICREDIT_ENTRATE_USCITE_AOA: unknown[][] = [
  ["Rapporto IT60B0200836282000101869818 - CONSULBROKERS S.P.A."],
  ["Data da:", "01/10/2026", "Data a:", "08/10/2026"],
  [],
  ["Data", "Valuta", "Descrizione", "Entrate", "Uscite"],
  [
    "01/10/2026",
    "01/10/2026",
    "BONIFICO SEPA DA  ROSSI MARIO PER  Rinnovo polizza 123",
    "1.234,56",
    "",
  ],
  ["02/10/2026", "02/10/2026", "Addebito canone conto", "", "15,00"],
];
