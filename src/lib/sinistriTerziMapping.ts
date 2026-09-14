/**
 * Mappatura per l'import dei sinistri "Aperti in corso" del Comune di Varese
 * (polizze NON del portafoglio CBnet, intermediate da Marsh) verso il modello
 * Sinistri Terzi di CBnet.
 *
 * Logica pura e testabile: nessuna dipendenza da Supabase o dall'ambiente.
 * Usata sia dai test unitari sia dallo script scripts/import-sinistri-varese.ts.
 */

/** Riga grezza dell'Excel Varese (colonne nell'ordine dell'intestazione, riga 3). */
export interface VareseSinistroRow {
  nSinistroMarsh: string;
  dataSinistro: string; // formato US "M/D/YY" o "M/D/YYYY"
  reclamanteAssicurato: string;
  nSinistroCompagnia: string;
  nPolizza: string;
  garanziaPrincipale: string;
  compagniaDelegataria: string;
}

/** Payload per l'azione "crea" della edge function gestione-sinistri (sinistro terzi). */
export interface CreaSinistroTerziPayload {
  azione: "crea";
  sinistro_terzi: true;
  stato_iniziale: "aperto";
  cliente_anagrafica_id: string;
  data_evento?: string;
  numero_sinistro_compagnia?: string;
  tipo_sinistro?: string;
  tipo_sinistro_personalizzato?: string;
  controparte?: string;
  descrizione: string;
  note_interne?: string;
  polizza_terzi: {
    numero_polizza?: string;
    compagnia_nome?: string;
    contraente?: string;
    garanzia_principale?: string;
    broker_riferimento: string;
    note?: string;
  };
}

const CONTRAENTE_DEFAULT = "Comune di Varese";
const BROKER = "Marsh";

/**
 * Converte una data Excel in formato US ("M/D/YY" o "M/D/YYYY") in ISO "yyyy-MM-dd".
 * Ritorna undefined se non interpretabile. Anni a 2 cifre: 00-79 -> 2000+, 80-99 -> 1900+.
 */
export function parseDataSinistroUS(raw: string): string | undefined {
  const t = (raw ?? "").trim();
  if (!t) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t; // gia' ISO
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return undefined;
  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = Number(m[3]);
  if (m[3].length === 2) year = year <= 79 ? 2000 + year : 1900 + year;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const iso = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  return iso;
}

/**
 * Mappa "Garanzia Principale" dell'Excel sul catalogo tipi sinistro CBnet.
 * Se non c'e' un match nel catalogo, usa il tipo personalizzato con l'etichetta originale.
 */
export function mapGaranziaToTipoSinistro(garanzia: string): {
  tipo_sinistro?: string;
  tipo_sinistro_personalizzato?: string;
} {
  const g = (garanzia ?? "").trim().toLowerCase();
  const std: Record<string, string> = {
    "rc patrimoniale": "rc_patrimoniale",
    "incendio (property)": "incendio",
    "spese legali": "difesa_legale",
    "eventi atmosferici": "evento_naturale",
    "rc terzi": "rct_danni_a_persone_e_cose",
    "rca attivo": "rca_danni_a_cose",
  };
  if (std[g]) return { tipo_sinistro: std[g] };
  const label = (garanzia ?? "").trim();
  return { tipo_sinistro_personalizzato: label || "Non specificata" };
}

/**
 * Garanzie di responsabilita' verso terzi: il "Reclamante" e' il terzo danneggiato,
 * non l'assicurato (Comune). Usato per decidere se valorizzare `controparte`.
 */
const GARANZIE_RESPONSABILITA_TERZI = new Set([
  "rc patrimoniale",
  "rc terzi",
  "rca attivo",
]);

/** True se il testo indica il Comune di Varese (assicurato), non un terzo. */
export function isComuneVarese(nome: string): boolean {
  const n = (nome ?? "").trim().toLowerCase();
  return n === "comune di varese";
}

/**
 * Normalizza i nomi compagnia con varianti (es. Unipol S.p.A. / SpA / UnipolSai).
 * Restituisce un nome canonico per ridurre i duplicati.
 */
export function normalizzaCompagnia(nome: string): string {
  const n = (nome ?? "").trim();
  if (!n) return n;
  const low = n.toLowerCase();
  if (low.startsWith("unipolsai")) return "UnipolSai Assicurazioni S.p.A.";
  if (low.startsWith("unipol")) return "Unipol Assicurazioni S.p.A.";
  return n;
}

/**
 * Costruisce il payload "crea" per un sinistro terzi a partire da una riga Excel.
 * `cliente_anagrafica_id` = id anagrafica del Comune di Varese (contraente comune a tutte le righe).
 */
export function buildSinistroTerziPayload(
  row: VareseSinistroRow,
  opts: { comuneVareseClienteId: string },
): CreaSinistroTerziPayload {
  const garanzia = (row.garanziaPrincipale ?? "").trim();
  const tipo = mapGaranziaToTipoSinistro(garanzia);
  const dataEvento = parseDataSinistroUS(row.dataSinistro);
  const reclamante = (row.reclamanteAssicurato ?? "").trim();
  const numeroPolizza = (row.nPolizza ?? "").trim();
  const numeroCompagnia = (row.nSinistroCompagnia ?? "").trim();
  const compagnia = normalizzaCompagnia(row.compagniaDelegataria);
  const marsh = (row.nSinistroMarsh ?? "").trim();

  // Il reclamante finisce in `controparte` quando non e' l'assicurato (Comune).
  const isTerzoReclamante =
    GARANZIE_RESPONSABILITA_TERZI.has(garanzia.toLowerCase()) || !isComuneVarese(reclamante);
  const controparte = reclamante && isTerzoReclamante && !isComuneVarese(reclamante)
    ? reclamante
    : undefined;

  const descrizione =
    `Sinistro importato Comune di Varese (broker Marsh). ` +
    `Garanzia: ${garanzia || "n/d"}. Polizza: ${numeroPolizza || "n/d"}. ` +
    `Compagnia: ${compagnia || "n/d"}.` +
    (marsh ? ` Rif. Marsh: ${marsh}.` : "");

  return {
    azione: "crea",
    sinistro_terzi: true,
    stato_iniziale: "aperto",
    cliente_anagrafica_id: opts.comuneVareseClienteId,
    ...(dataEvento ? { data_evento: dataEvento } : {}),
    ...(numeroCompagnia ? { numero_sinistro_compagnia: numeroCompagnia } : {}),
    ...(tipo.tipo_sinistro ? { tipo_sinistro: tipo.tipo_sinistro } : {}),
    ...(tipo.tipo_sinistro_personalizzato
      ? { tipo_sinistro_personalizzato: tipo.tipo_sinistro_personalizzato }
      : {}),
    ...(controparte ? { controparte } : {}),
    descrizione,
    ...(marsh ? { note_interne: `Rif. Marsh: ${marsh}` } : {}),
    polizza_terzi: {
      ...(numeroPolizza ? { numero_polizza: numeroPolizza } : {}),
      ...(compagnia ? { compagnia_nome: compagnia } : {}),
      contraente: CONTRAENTE_DEFAULT,
      ...(garanzia ? { garanzia_principale: garanzia } : {}),
      broker_riferimento: BROKER,
      ...(marsh ? { note: `N. Sinistro Marsh: ${marsh}` } : {}),
    },
  };
}
