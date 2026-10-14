import { describe, expect, it } from "vitest";
import {
  aggregateFrequenzaMensile,
  aggregatePerCompagnia,
  aggregatePerStato,
  aggregatePerTipo,
  aggregatePerZona,
  buildSinistriReportKpi,
  buildSinistriReportSheets,
  resolveZonaSinistro,
  topZonaChart,
} from "../sinistriReportGrafico";

const rows = [
  {
    numero_sinistro: "S-1",
    stato: "aperto",
    tipo_sinistro: "rca_danni_a_cose",
    data_evento: "2026-01-15",
    citta_sinistro: "Varese",
    luogo_sinistro: "Biumo",
    provincia_sinistro: "VA",
    importo_riserva: 1000,
    importo_liquidato: 0,
    compagnie: { nome: "Generali" },
    clienti: { ragione_sociale: "Comune di Varese", tipo_cliente: "ente" },
  },
  {
    numero_sinistro: "S-2",
    stato: "chiuso",
    tipo_sinistro: "rca_danni_a_cose",
    data_evento: "2026-03-02",
    citta_sinistro: "Varese",
    luogo_sinistro: "Biumo",
    importo_riserva: 0,
    importo_liquidato: 400,
    compagnie: { nome: "Generali" },
  },
  {
    numero_sinistro: "S-3",
    stato: "in_lavorazione",
    tipo_sinistro: "cristalli",
    data_evento: "2026-03-20",
    citta_sinistro: "Gallarate",
    importo_riserva: 200,
    importo_liquidato: 0,
    compagnie: { nome: "Unipol" },
  },
  {
    numero_sinistro: "S-4",
    stato: "chiuso",
    tipo_sinistro: "furto",
    data_evento: null,
    importo_riserva: 0,
    importo_liquidato: 50,
  },
];

describe("resolveZonaSinistro", () => {
  it("usa luogo + città se diversi", () => {
    expect(resolveZonaSinistro({ luogo_sinistro: "Biumo", citta_sinistro: "Varese" })).toBe("Biumo — Varese");
  });

  it("non duplica se luogo e città coincidono", () => {
    expect(resolveZonaSinistro({ luogo_sinistro: "Varese", citta_sinistro: "Varese" })).toBe("Varese");
  });

  it("cade su città, poi provincia, poi Non specificato", () => {
    expect(resolveZonaSinistro({ citta_sinistro: "Gallarate" })).toBe("Gallarate");
    expect(resolveZonaSinistro({ provincia_sinistro: "VA" })).toBe("Prov. VA");
    expect(resolveZonaSinistro({})).toBe("Non specificato");
  });
});

describe("aggregazioni report sinistri", () => {
  it("kpi conta aperti/chiusi e chi ha zona", () => {
    const kpi = buildSinistriReportKpi(rows);
    expect(kpi.totale).toBe(4);
    expect(kpi.aperti).toBe(2);
    expect(kpi.chiusi).toBe(2);
    expect(kpi.conZona).toBe(3);
    expect(kpi.riserva).toBe(1200);
    expect(kpi.liquidato).toBe(450);
  });

  it("aggrega per zona e mette Biumo in testa", () => {
    const zona = aggregatePerZona(rows);
    expect(zona[0]).toMatchObject({ name: "Biumo — Varese", sinistri: 2, aperti: 1, chiusi: 1 });
    expect(zona.find((z) => z.name === "Gallarate")?.sinistri).toBe(1);
  });

  it("collassa le zone extra in Altre", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      stato: "aperto",
      citta_sinistro: `Zona ${i}`,
    }));
    const chart = topZonaChart(aggregatePerZona(many), 12);
    expect(chart).toHaveLength(13);
    expect(chart[12].name).toBe("Altre");
    expect(chart[12].sinistri).toBe(2);
  });

  it("riempie i mesi vuoti tra il primo e l'ultimo accadimento", () => {
    const freq = aggregateFrequenzaMensile(rows);
    expect(freq.map((f) => f.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(freq[1].sinistri).toBe(0);
    expect(freq[2].sinistri).toBe(2);
  });

  it("aggrega tipo e stato", () => {
    const tipo = aggregatePerTipo(rows);
    const rca = tipo.find((t) => t.name === "RCA danni a cose");
    expect(rca).toEqual({ name: "RCA danni a cose", aperti: 1, chiusi: 1 });
    const stati = aggregatePerStato(rows);
    expect(stati.find((s) => s.name === "APERTO")?.value).toBe(1);
    expect(stati.find((s) => s.name === "CHIUSO")?.value).toBe(2);
  });

  it("aggrega compagnie e mette Senza compagnia", () => {
    const c = aggregatePerCompagnia(rows);
    expect(c[0]).toEqual({ name: "Generali", value: 2 });
    expect(c.find((x) => x.name === "Senza compagnia")?.value).toBe(1);
  });

  it("prepara fogli Excel con zona, frequenza e dettaglio", () => {
    const sheets = buildSinistriReportSheets(rows);
    expect(sheets.riepilogo[0]).toEqual({ Indicatore: "Sinistri", Valore: 4 });
    expect(sheets.zona[0].Zona).toBe("Biumo — Varese");
    expect(sheets.frequenza).toHaveLength(3);
    expect(sheets.dettaglio[0]["N° Sinistro"]).toBe("S-1");
    expect(sheets.dettaglio[0].Cliente).toBe("Comune di Varese");
    expect(sheets.dettaglio[0].Zona).toBe("Biumo — Varese");
  });
});
