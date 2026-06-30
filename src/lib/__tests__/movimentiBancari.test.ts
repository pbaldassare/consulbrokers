import { describe, expect, it } from "vitest";
import {
  extractOrdinanteFromDescrizione,
  normalizeExcelRow,
  resolveOrdinanteImport,
} from "@/lib/movimentiBancari";

describe("extractOrdinanteFromDescrizione", () => {
  it("estrae ordinante da estratto BCC", () => {
    expect(
      extractOrdinanteFromDescrizione(
        "Bonifico a vs favore *SPIX ITALIA - SRL RINNOVO POLIZZE AUTO N.153789452",
      ),
    ).toBe("SPIX ITALIA - SRL");
    expect(
      extractOrdinanteFromDescrizione(
        "Bonifico a vs favore *COMUNE DI RIPALIMOSANI CIG B23A35C73B LIQUIDAZIONE PREMIO",
      ),
    ).toBe("COMUNE DI RIPALIMOSANI");
    expect(
      extractOrdinanteFromDescrizione(
        "Bonifico a vs favore *COMUNE DI COLLETORTO 2026-00541-000005732 POLIZZA RCT",
      ),
    ).toBe("COMUNE DI COLLETORTO");
  });

  it("legge etichetta ORDINANTE", () => {
    expect(extractOrdinanteFromDescrizione("ORDINANTE: ROSSI MARIO SRL CRO 123")).toBe("ROSSI MARIO SRL");
  });
});

describe("resolveOrdinanteImport", () => {
  it("preferisce colonna dedicata", () => {
    expect(resolveOrdinanteImport("Cliente SRL", "Bonifico a vs favore *ALTRO")).toBe("Cliente SRL");
  });

  it("usa descrizione se colonna vuota", () => {
    expect(
      resolveOrdinanteImport("", "Bonifico a vs favore *CASSA RURALE ED ARTIGIANA DI CASTELLANA RINNOVO"),
    ).toBe("CASSA RURALE ED ARTIGIANA DI CASTELLANA");
  });
});

describe("normalizeExcelRow", () => {
  it("trimma le chiavi colonna", () => {
    expect(normalizeExcelRow({ " Importo ": 10, "Data contabile": "2026-06-01" })).toEqual({
      Importo: 10,
      "Data contabile": "2026-06-01",
    });
  });
});
