import * as XLSX from "xlsx";
import type { ECClienteData } from "@/lib/ec-cliente-pdf";

export interface ExportXlsxOptions {
  /** Filtri applicati al momento dell'export (per audit / tracciabilità). */
  filtri?: {
    periodoDal?: string;
    periodoAl?: string;
    categoria?: string;
    causaleCodice?: string;
    causaleDescrizione?: string;
  };
  /**
   * Note di riconciliazione bancaria per ciascuna polizza inclusa.
   * Chiave = numero polizza. Se assente la polizza è considerata "Non riconciliata".
   */
  riconciliazione?: Record<string, { stato: "riconciliato" | "non_riconciliato"; nota?: string }>;
}


/**
 * Esporta l'E/C cliente in Excel includendo per ogni polizza
 * le eventuali compensazioni contabili applicate.
 *
 * Layout (una riga = una polizza, più sub-righe indentate per le compensazioni):
 *   Polizza | Ramo | Rischio | Compagnia | Effetto | Premio | Compensazioni | Dovuto
 *
 * Le compensazioni di segno '+' (riducono il dovuto) sono mostrate negative
 * nella colonna "Compensazioni"; quelle di segno '-' (aumentano) come positive.
 */
export function exportECClienteXlsx(d: ECClienteData, fileName: string) {
  const aoa: any[][] = [];
  aoa.push([
    "Polizza", "Ramo", "Rischio", "Compagnia", "Effetto",
    "Premio (€)", "Compensazioni (€)", "Dovuto (€)", "Note",
  ]);
  for (const r of d.righe) {
    const comp = r.compensazioni || [];
    const compNet = comp.reduce((s, c) => s + (c.segno === "+" ? -c.importo : c.importo), 0);
    const dovuto = r.premio + compNet;
    aoa.push([
      r.polizza, r.ramo, r.rischio, r.compagnia, r.effetto,
      Number(r.premio.toFixed(2)),
      compNet ? Number(compNet.toFixed(2)) : "",
      Number(dovuto.toFixed(2)),
      "",
    ]);
    for (const c of comp) {
      const impEff = c.segno === "+" ? -c.importo : c.importo;
      aoa.push([
        "", "", `   ↳ ${c.codice} — ${c.descrizione}`, "", "",
        "", Number(impEff.toFixed(2)), "", c.note || "",
      ]);
    }
  }
  // Totali
  const totPremi = d.righe.reduce((s, r) => s + r.premio, 0);
  const totComp = d.righe.reduce((s, r) => {
    const comp = r.compensazioni || [];
    return s + comp.reduce((a, c) => a + (c.segno === "+" ? -c.importo : c.importo), 0);
  }, 0);
  aoa.push([]);
  aoa.push(["", "", "", "", "TOTALE",
    Number(totPremi.toFixed(2)),
    totComp ? Number(totComp.toFixed(2)) : "",
    Number(d.totale.toFixed(2)),
    "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 18 }, { wch: 22 }, { wch: 32 }, { wch: 22 }, { wch: 12 },
    { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 30 },
  ];

  // Intestazione documento in un secondo foglio
  const meta: any[][] = [
    ["Estratto Conto Cliente"],
    [],
    ["Cliente", d.clienteNome],
    ["Indirizzo", [d.clienteIndirizzo, d.clienteCap, d.clienteCitta, d.clienteProvincia].filter(Boolean).join(" ")],
    ["Sede emittente", d.sedeNome || ""],
    ["Luogo / data", d.luogoData],
    ["Oggetto", d.oggetto],
    [],
    ["Coordinate bancarie"],
    ["Intestatario", d.intestatarioConto],
    ["Banca", d.bancaConto],
    ["IBAN", d.iban],
    [],
    ["Totale dovuto (€)", Number(d.totale.toFixed(2))],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  wsMeta["!cols"] = [{ wch: 22 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Polizze");
  XLSX.utils.book_append_sheet(wb, wsMeta, "Intestazione");
  XLSX.writeFile(wb, fileName);
}
