import { describe, expect, it } from "vitest";

import {
  isTipoPagamentoAliasBonificoEsterno,
  isTipoPagamentoIncassoZero,
  isTipoPagamentoPos,
  resolveTipoPagamentoLabel,
  resolveTipoPagamentoPerNotificaAgenzia,
  testoIntroIncassoAgenzia,
  resolveTipoPagamentoTitoloIncasso,
  tipoPagamentoRichiedeConto,
  TIPI_PAGAMENTO_MESSA_CASSA,
  TIPO_PAGAMENTO_COMPENSAZIONE,
  TIPO_PAGAMENTO_COSTI_CONSULBROKERS,
  TIPO_PAGAMENTO_DIREITO_COMPAGNIA,
  TIPO_PAGAMENTO_INCASSO_ZERO,
} from "@/lib/incassoTipoPagamento";

describe("resolveTipoPagamentoTitoloIncasso", () => {
  it("pagamento diretto compagnia ha priorità su cash/acconti", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 111.28,
        usatoAnticipi: 0,
        residuoCash: 0,
        haCompensazioni: false,
        tipoPagamentoPrincipale: TIPO_PAGAMENTO_DIREITO_COMPAGNIA,
      }),
    ).toBe(TIPO_PAGAMENTO_DIREITO_COMPAGNIA);
  });

  it("bonifico principale con acconti → bonifico (non anticipo_misto)", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 40,
        residuoCash: 60,
        haCompensazioni: false,
        tipoPagamentoPrincipale: "bonifico",
      }),
    ).toBe("bonifico");
  });

  it("bonifico principale solo acconti → bonifico", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 100,
        residuoCash: 0,
        haCompensazioni: false,
        tipoPagamentoPrincipale: "bonifico",
      }),
    ).toBe("bonifico");
  });

  it("costi consulbrokers con acconti → costi_consulbrokers (preservato)", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 40,
        residuoCash: 60,
        haCompensazioni: false,
        tipoPagamentoPrincipale: TIPO_PAGAMENTO_COSTI_CONSULBROKERS,
      }),
    ).toBe(TIPO_PAGAMENTO_COSTI_CONSULBROKERS);
  });

  it("compensazione con acconti → compensazione (preservato)", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 30,
        residuoCash: 70,
        haCompensazioni: true,
        tipoPagamentoPrincipale: TIPO_PAGAMENTO_COMPENSAZIONE,
      }),
    ).toBe(TIPO_PAGAMENTO_COMPENSAZIONE);
  });

  it("solo acconti da conto bancario → bonifico", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 1080,
        usatoAnticipi: 1080,
        residuoCash: 0,
        haCompensazioni: false,
        tipoPagamentoPrincipale: "contanti",
        anticipiDaContoBancario: true,
      }),
    ).toBe("bonifico");
  });

  it("contanti con acconti misti → anticipo_misto", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 30,
        residuoCash: 70,
        haCompensazioni: false,
        tipoPagamentoPrincipale: "contanti",
      }),
    ).toBe("anticipo_misto");
  });

  it("bonifico con abbuono/compensazioni → bonifico (non compensato)", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 29808.83,
        usatoAnticipi: 0,
        residuoCash: 24808.83,
        haCompensazioni: true,
        tipoPagamentoPrincipale: "bonifico",
      }),
    ).toBe("bonifico");
  });

  it("contanti con abbuono → contanti", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 0,
        residuoCash: 70,
        haCompensazioni: true,
        tipoPagamentoPrincipale: "contanti",
      }),
    ).toBe("contanti");
  });

  it("preserva incasso_zero anche con premio, acconti e compensazioni", () => {
    expect(
      resolveTipoPagamentoTitoloIncasso({
        dovuto: 100,
        usatoAnticipi: 20,
        residuoCash: 80,
        haCompensazioni: true,
        tipoPagamentoPrincipale: TIPO_PAGAMENTO_INCASSO_ZERO,
      }),
    ).toBe(TIPO_PAGAMENTO_INCASSO_ZERO);
  });
});

describe("isTipoPagamentoAliasBonificoEsterno", () => {
  it("include bonifico, costi consulbrokers e compensazione", () => {
    expect(isTipoPagamentoAliasBonificoEsterno("bonifico")).toBe(true);
    expect(isTipoPagamentoAliasBonificoEsterno(TIPO_PAGAMENTO_COSTI_CONSULBROKERS)).toBe(true);
    expect(isTipoPagamentoAliasBonificoEsterno(TIPO_PAGAMENTO_COMPENSAZIONE)).toBe(true);
    expect(isTipoPagamentoAliasBonificoEsterno("contanti")).toBe(false);
    expect(isTipoPagamentoAliasBonificoEsterno("compensato")).toBe(false);
  });
});

describe("resolveTipoPagamentoPerNotificaAgenzia", () => {
  it("mappa alias bonifico esterno a Bonifico", () => {
    expect(resolveTipoPagamentoPerNotificaAgenzia("bonifico")).toBe("Bonifico");
    expect(resolveTipoPagamentoPerNotificaAgenzia(TIPO_PAGAMENTO_COSTI_CONSULBROKERS)).toBe("Bonifico");
    expect(resolveTipoPagamentoPerNotificaAgenzia(TIPO_PAGAMENTO_COMPENSAZIONE)).toBe("Bonifico");
    expect(resolveTipoPagamentoPerNotificaAgenzia("contanti")).toBe("Contanti");
    expect(resolveTipoPagamentoPerNotificaAgenzia("pos")).toBe("POS / Carta");
    expect(resolveTipoPagamentoPerNotificaAgenzia("assegno")).toBe("Assegno");
  });
});

describe("testoIntroIncassoAgenzia", () => {
  it("usa il testo formale con mezzo Bonifico", () => {
    expect(testoIntroIncassoAgenzia({ mezzo: "Bonifico" })).toBe(
      "In data odierna abbiamo incassato per Vostro conto a mezzo Bonifico il seguente premio che vi accrediteremo al netto delle provvigioni come da accordi:",
    );
  });

  it("parametrizza il mezzo reale (POS, assegno)", () => {
    expect(testoIntroIncassoAgenzia({ mezzo: "POS / Carta" })).toContain("a mezzo POS / Carta il seguente premio");
    expect(testoIntroIncassoAgenzia({ mezzo: "Assegno" })).toContain("a mezzo Assegno il seguente premio");
  });

  it("al plurale cambia solo premio → premi", () => {
    expect(testoIntroIncassoAgenzia({ mezzo: "Bonifico", bulk: true })).toBe(
      "In data odierna abbiamo incassato per Vostro conto a mezzo Bonifico i seguenti premi che vi accrediteremo al netto delle provvigioni come da accordi:",
    );
  });
});

describe("resolveTipoPagamentoLabel", () => {
  it.each([
    ["bonifico", "Bonifico"],
    ["pos", "POS / Carta"],
    ["contanti", "Contanti"],
    ["assegno", "Assegno"],
    ["rid", "RID / Addebito SEPA"],
    ["garantito", "Garantito"],
    [TIPO_PAGAMENTO_DIREITO_COMPAGNIA, "Pagamento diretto compagnia"],
    ["anticipo", "Acconto"],
    ["anticipo_misto", "Acconto + altro pagamento"],
    [TIPO_PAGAMENTO_INCASSO_ZERO, "Messa a cassa a zero"],
  ])("mappa %s in %s", (tipo, label) => {
    expect(resolveTipoPagamentoLabel(tipo)).toBe(label);
  });

  it("se la modalità manca lo segnala senza inventarla", () => {
    expect(resolveTipoPagamentoLabel(null)).toBe("Modalità non registrata");
  });

  it("rende leggibili eventuali valori non ancora mappati", () => {
    expect(resolveTipoPagamentoLabel("nuovo_metodo")).toBe("Nuovo Metodo");
  });
});

describe("tipoPagamentoRichiedeConto", () => {
  it("POS e bonifico richiedono il conto della sede", () => {
    expect(isTipoPagamentoPos("pos")).toBe(true);
    expect(isTipoPagamentoPos("carta_credito")).toBe(true);
    expect(isTipoPagamentoPos("bonifico")).toBe(false);
    expect(tipoPagamentoRichiedeConto("pos")).toBe(true);
    expect(tipoPagamentoRichiedeConto("carta_credito")).toBe(true);
    expect(tipoPagamentoRichiedeConto("bonifico")).toBe(true);
    expect(tipoPagamentoRichiedeConto("contanti")).toBe(false);
    expect(tipoPagamentoRichiedeConto("assegno")).toBe(false);
    expect(tipoPagamentoRichiedeConto(TIPO_PAGAMENTO_DIREITO_COMPAGNIA)).toBe(false);
  });
});

describe("opzione Messa a cassa a zero", () => {
  it("espone nel menu il codice esistente e la label esatta", () => {
    expect(TIPI_PAGAMENTO_MESSA_CASSA).toContainEqual({
      value: "incasso_zero",
      label: "Messa a cassa a zero",
    });
    expect(isTipoPagamentoIncassoZero("incasso_zero")).toBe(true);
    expect(isTipoPagamentoIncassoZero("bonifico")).toBe(false);
  });
});
