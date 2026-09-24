import { describe, expect, it } from "vitest";
import {
  chunkIds,
  clientiOrFilter,
  filenameDistintaRestituzione,
  groupRestituzioneByCompagnia,
  slugAgenziaFilename,
  tipoTitoloRestituzione,
  type RestituzioneDocRiga,
} from "../restituzioneOriginali";
import { buildDistintaRestituzionePdf } from "../restituzioneOriginaliPdf";

function riga(partial: Partial<RestituzioneDocRiga>): RestituzioneDocRiga {
  return {
    documentoId: "d1",
    nomeFile: "polizza.pdf",
    createdAt: "2026-01-01",
    titoloId: "t1",
    numeroTitolo: "123",
    tipoTitolo: "polizza",
    clienteId: "c1",
    clienteNome: "Rossi",
    compagniaId: "ag1",
    compagniaNome: "Generali",
    inviato: false,
    ...partial,
  };
}

describe("tipoTitoloRestituzione", () => {
  it("distingue polizza, quietanza e regolazione", () => {
    expect(tipoTitoloRestituzione({})).toBe("polizza");
    expect(tipoTitoloRestituzione({ sostituisce_polizza: "123" })).toBe("quietanza");
    expect(tipoTitoloRestituzione({ is_regolazione: true })).toBe("regolazione");
  });
});

describe("groupRestituzioneByCompagnia", () => {
  it("un PDF / gruppo per agenzia", () => {
    const groups = groupRestituzioneByCompagnia([
      riga({ documentoId: "a", compagniaId: "g1", compagniaNome: "Generali" }),
      riga({ documentoId: "b", compagniaId: "g1", compagniaNome: "Generali" }),
      riga({ documentoId: "c", compagniaId: "u1", compagniaNome: "Unipol" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.compagniaNome === "Generali")?.rows).toHaveLength(2);
    expect(groups.find((g) => g.compagniaNome === "Unipol")?.rows).toHaveLength(1);
  });

  it("raggruppa senza id usando il nome", () => {
    const groups = groupRestituzioneByCompagnia([
      riga({ documentoId: "a", compagniaId: null, compagniaNome: "AXA" }),
      riga({ documentoId: "b", compagniaId: null, compagniaNome: "AXA" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(2);
  });
});

describe("filename e filtri", () => {
  it("slug e nome file distinta", () => {
    expect(slugAgenziaFilename("IRCCS Fondazione G.B.")).toBe("IRCCS_Fondazione_G_B");
    expect(filenameDistintaRestituzione("Generali", new Date(2026, 8, 24))).toBe(
      "distinta_originali_Generali_20260924.pdf",
    );
  });

  it("genera un PDF distinta per compagnia", async () => {
    const groups = groupRestituzioneByCompagnia([
      riga({ documentoId: "a", nomeFile: "orig.pdf", numeroTitolo: "weewww" }),
    ]);
    const bytes = await buildDistintaRestituzionePdf(groups[0], new Date(2026, 8, 24));
    expect(bytes.byteLength).toBeGreaterThan(200);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });

  it("chunk e or filter clienti", () => {
    expect(chunkIds(["a", "b", "c"], 2)).toEqual([["a", "b"], ["c"]]);
    expect(clientiOrFilter(["id1", "id2"])).toBe(
      "cliente_id.in.(id1,id2),cliente_anagrafica_id.in.(id1,id2)",
    );
  });
});
