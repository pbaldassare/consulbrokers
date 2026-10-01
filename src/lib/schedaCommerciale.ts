export type AnagraficaMini = {
  nome?: string | null;
  cognome?: string | null;
  ragione_sociale?: string | null;
};

export function nomeAnagraficaProf(a?: AnagraficaMini | null, fallback?: string | null): string {
  const fromAna = a ? (a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim()) : "";
  const name = (fromAna || fallback || "").trim();
  return name && name !== "—" ? name : "—";
}

export type RipartoRiga = {
  ruolo: "produttore" | "ae" | "agenzia";
  nome: string;
  perc: number;
  importo: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Totale provvigioni di rata: quietanza se valorizzata, altrimenti firma. */
export function totProvvigioniRata(t: {
  provvigioni_firma?: number | null;
  provvigioni_quietanza?: number | null;
}): number {
  const q = Number(t.provvigioni_quietanza) || 0;
  const f = Number(t.provvigioni_firma) || 0;
  return q > 0 ? q : f;
}

export function buildRipartoCommerciale(opts: {
  totProvv: number;
  splits?: { nome: string; perc: number }[];
  commercialeNome?: string | null;
  percentualeCommerciale?: number | null;
  aeNome?: string | null;
  aePerc?: number | null;
}): { righe: RipartoRiga[]; totProvv: number; hasProduttore: boolean } {
  const tot = round2(Number(opts.totProvv) || 0);
  const splits = (opts.splits || []).filter((s) => (Number(s.perc) || 0) > 0);
  const prodRows: RipartoRiga[] = [];

  if (splits.length > 0) {
    for (const s of splits) {
      const perc = Number(s.perc) || 0;
      prodRows.push({
        ruolo: "produttore",
        nome: s.nome || "—",
        perc,
        importo: round2((tot * perc) / 100),
      });
    }
  } else if (opts.commercialeNome && opts.commercialeNome !== "—") {
    const perc = opts.percentualeCommerciale != null && opts.percentualeCommerciale !== undefined
      ? Number(opts.percentualeCommerciale) || 0
      : 100;
    prodRows.push({
      ruolo: "produttore",
      nome: opts.commercialeNome,
      perc,
      importo: round2((tot * perc) / 100),
    });
  }

  const aePerc = Number(opts.aePerc) || 0;
  const aeNome = (opts.aeNome || "").trim();
  const aeRows: RipartoRiga[] =
    aePerc > 0 && aeNome && aeNome !== "—"
      ? [{ ruolo: "ae", nome: aeNome, perc: aePerc, importo: round2((tot * aePerc) / 100) }]
      : [];

  const used = prodRows.reduce((s, r) => s + r.perc, 0) + aeRows.reduce((s, r) => s + r.perc, 0);
  const residuoPerc = Math.max(0, round2(100 - used));
  const residuo: RipartoRiga = {
    ruolo: "agenzia",
    nome: "Consulbrokers SPA",
    perc: residuoPerc,
    importo: round2((tot * residuoPerc) / 100),
  };

  return {
    totProvv: tot,
    hasProduttore: prodRows.length > 0,
    righe: [...prodRows, ...aeRows, residuo],
  };
}
