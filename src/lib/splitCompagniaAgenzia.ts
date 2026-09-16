/**
 * Spezza un'anagrafica `compagnie.nome` in compagnia/gruppo + agenzia/rapporto.
 *
 * Esempio: "ALLIANZ RAS MANIAGO SPILIMBERGO"
 * → gruppo ALLIANZ, agenzia MANIAGO SPILIMBERGO.
 */

export type SplitEsito =
  | "agenzia_da_brand"
  | "solo_compagnia"
  | "gia_agenzia"
  | "direzione"
  | "sconosciuta";

export type SplitCompagniaAgenzia = {
  brand: string | null;
  gruppo: string | null;
  agenzia: string | null;
  esito: SplitEsito;
  motivo: string;
};

type BrandDef = {
  prefixes: string[];
  gruppo: string;
};

/** Prefissi più lunghi prima: ALLIANZ RAS vince su ALLIANZ. */
export const BRAND_PREFIXES: BrandDef[] = [
  { prefixes: ["ALLIANZ VIVA SPA", "ALLIANZ VIVA"], gruppo: "Allianz Viva Spa" },
  { prefixes: ["ALLIANZ GLOBAL LIFE DAC", "ALLIANZ GLOBAL LIFE"], gruppo: "ALLIANZ" },
  { prefixes: ["ALLIANZ WORLDWIDE CARE", "ALLIANZ CARE"], gruppo: "ALLIANZ" },
  { prefixes: ["ALLIANZ NEXT SPA", "ALLIANZ NEXT"], gruppo: "ALLIANZ" },
  { prefixes: ["ALLIANZ LLOYD ADRIATICO"], gruppo: "ALLIANZ" },
  { prefixes: ["ALLIANZ RAS"], gruppo: "ALLIANZ" },
  { prefixes: ["ALLIANZ SPA", "ALLIANZ"], gruppo: "ALLIANZ" },
  { prefixes: ["GENERALI DIV CATTOLICA", "GENERALI DIVISIONE CATTOLICA"], gruppo: "Generali Div. Cattolica" },
  { prefixes: ["GENERALI ITALIA SPA", "GENERALI ITALI SPA", "GENERALI ITALIA", "GENERALI ASSICURAZIONI", "GENERALI"], gruppo: "GENERALI ITALIA" },
  { prefixes: ["CATTOLICA ASSICURAZIONI", "CATTOLICA"], gruppo: "CATTOLICA" },
  { prefixes: ["UNIPOL ASSICURAZIONI SPA", "UNIPOL ASSICURAZIONI"], gruppo: "Unipol Assicurazioni S.p.a." },
  { prefixes: ["UNIPOLSAI", "UNIPOL"], gruppo: "UNIPOLSAI" },
  { prefixes: ["UNISALUTE SPA", "UNISALUTE"], gruppo: "UNIPOLSAI" },
  { prefixes: ["ITAS MUTUA", "ITAS"], gruppo: "Itas Mutua" },
  { prefixes: ["REALE MUTUA ASSICURAZIONI", "REALE MUTUA", "REALE"], gruppo: "REALE MUTUA" },
  { prefixes: ["ITALIANA ASSICURAZIONI", "ITALIANA"], gruppo: "Italiana Assicurazioni" },
  { prefixes: ["VITTORIA ASSICURAZIONI", "VITTORIA"], gruppo: "Vittoria Ass.ni" },
  { prefixes: ["GROUPAMA ASSICURAZIONI SPA", "GROUPAMA ASSICURAZIONI", "GROUPAMA"], gruppo: "Groupama Assicurazioni Spa" },
  { prefixes: ["HDI GLOBAL SE", "HDI GLOBAL"], gruppo: "Hdi Global Se" },
  { prefixes: ["HDI ASSICURAZIONI SPA", "HDI ASSICURAZIONI", "HDI"], gruppo: "Hdi Assicurazioni Spa" },
  { prefixes: ["HELVETIA VITA SPA", "HELVETIA VITA", "HELVETIA ASSICURAZIONI", "HELVETIA"], gruppo: "HELVETIA" },
  { prefixes: ["AXA ASSISTANCE"], gruppo: "Axa Assistance" },
  { prefixes: ["AXA ART", "AXA QUIRINALE", "AXA VIMINALE", "AXA XL", "AXA"], gruppo: "AXA" },
  { prefixes: ["ZURICH INVESTMENTS LIFE", "ZURICH INSURANCE PLC", "ZURICH INSURANCE", "ZURICH"], gruppo: "Zurich Insurance Company Ltd" },
  { prefixes: ["CHUBB EUROPEAN GROUP SE", "CHUBB EUROPEAN GROUP LIMITED", "CHUBB EUROPEAN GROUP", "CHUBB"], gruppo: "CHUBB" },
  { prefixes: ["AIG EUROPE LIMITED", "AIG EUROPE SA", "AIG EUROPE", "AIG ADVISORS", "AIG"], gruppo: "AIG" },
  { prefixes: ["AMTRUST ASSICURAZIONI", "AM TRUST ASSICURAZIONI", "AMTRUST INSURANCE AGENCY ITALY", "AM TRUST INSURANCE AGENCY ITALY", "AMTRUST", "AM TRUST"], gruppo: "Amtrust Assicurazioni Spa" },
  { prefixes: ["ARAG SE", "ARAG"], gruppo: "ARAG" },
  { prefixes: ["ARGOGLOBAL ASSICURAZIONI SPA", "ARGOGLOBAL ASSICURAZIONI", "ARGOGLOBAL SE", "ARGOGLOBAL"], gruppo: "Argoglobal Assicurazioni Spa" },
  { prefixes: ["ASSICURATRICE MILANESE"], gruppo: "ASSICURATRICE MILANESE" },
  { prefixes: ["ATRADIUS CREDITO Y CAUCION SA", "ATRADIUS CREDIT Y CAUCION SA", "ATRADIUS"], gruppo: "ATRADIUS" },
  { prefixes: ["BENE ASSICURAZIONI SPA", "BENE ASSICURAZIONI", "BENE"], gruppo: "BENE" },
  { prefixes: ["CNA INSURANCE COMPANY EUROPE SA", "CNA INSURANCE", "CNA"], gruppo: "CNA" },
  { prefixes: ["COFACE ASSICURAZIONI", "COFACE"], gruppo: "COFACE" },
  { prefixes: ["DAS DIFESA AUTOMOBILISTICA SPA", "DAS DIFESA LEGALE", "DAS SPA", "DAS"], gruppo: "DAS" },
  { prefixes: ["ELBA ASSICURAZIONI SPA", "ELBA ASSICURAZIONI", "REVO INSURANCE SPA", "REVO"], gruppo: "REVO" },
  { prefixes: ["EUROP ASSISTANCE ITALIA SPA", "EUROP ASSISTANCE ITALIA", "EUROP ASSISTANCE"], gruppo: "EUROP ASSISTANCE ITALIA" },
  { prefixes: ["GREAT LAKES INSURANCE SE", "GREAT LAKES"], gruppo: "Great Lakes Insurance Re" },
  { prefixes: ["LLOYDS INSURANCE COMPANY SA", "LLOYDS OF LONDON", "LLOYDS"], gruppo: "Lloyd's" },
  { prefixes: ["LIBERTY MUTUAL INSURANCE", "LIBERTY SPECIALTY MARKETS", "LIBERTY MUTUAL", "LIBERTY"], gruppo: "LIBERTY" },
  { prefixes: ["METLIFE EUROPE DAC", "METLIFE EUROPE", "METLIFE"], gruppo: "METLIFE" },
  { prefixes: ["NOBIS COMPAGNIA DI ASSICURAZIONI", "NOBIS"], gruppo: "NOBIS" },
  { prefixes: ["SACE BT SPA", "SACE BT", "SACE"], gruppo: "SACE" },
  { prefixes: ["SARA ASSICURAZIONI", "SARA"], gruppo: "Sara Ass.ni" },
  { prefixes: ["TOKIO MARINE EUROPE SA", "TOKIO MARINE"], gruppo: "TOKIO MARINE" },
  { prefixes: ["UCA ASSICURAZIONI SPA", "UCA ASSICURAZIONI", "UCA"], gruppo: "Uca Assicurazioni S.p.a." },
  { prefixes: ["QBE EUROPE", "QBE"], gruppo: "QBE" },
  { prefixes: ["ROLAND RECHTSSCHUTZ", "ROLAND"], gruppo: "ROLAND RECHTSSCHUTZ VERSICHERUNGS AG" },
  { prefixes: ["BALCIA INSURANCE SE", "BALCIA"], gruppo: "Balcia Insurance Se" },
  { prefixes: ["BERKSHIRE HATHAWAY"], gruppo: "Berkshire Hathaway International Insurance Limite" },
  { prefixes: ["GLOBAL ASSISTANCE"], gruppo: "GLOBAL ASSISTANCE" },
  { prefixes: ["POSTE VITA SPA", "POSTE VITA", "POSTE"], gruppo: "POSTE" },
  { prefixes: ["FONDIARIA SAI", "FONDIARIA"], gruppo: "FONDIARIA - SAI" },
  { prefixes: ["AVIVA"], gruppo: "AVIVA" },
  { prefixes: ["AMISSIMA"], gruppo: "AMISSIMA" },
  { prefixes: ["ASSIMOCO"], gruppo: "ASSIMOCO" },
  { prefixes: ["VERTI"], gruppo: "VERTI ASS.NI S.P.A." },
  { prefixes: ["XL INSURANCE"], gruppo: "XL INSURANCE COMPANY SE" },
  { prefixes: ["CONVEX EUROPE SA", "CONVEX EUROPE", "CONVEX"], gruppo: "CONVEX INSURANCE" },
  { prefixes: ["HDI GLOBAL SPECIALTY SE", "HDI GLOBAL SPECIALTY"], gruppo: "Hdi Global Se" },
  { prefixes: ["SOMPO INTERNATIONAL", "SOMPO"], gruppo: "SOMPO INSURANCE" },
  { prefixes: ["DALLBOGG", "DALLBOG"], gruppo: "DALLBOG" },
  { prefixes: ["DUAL ITALIA", "DUAL"], gruppo: "DUAL AGENCY" },
];

const EMPTY_REMAINDER = new Set([
  "",
  "DIREZIONE",
  "DIR",
  "SEDE",
  "ITALIAN BRANCH",
  "BRANCH",
  "INSURANCE",
  "ASSICURAZIONI",
  "SPA",
  "SA",
  "DAC",
  "PLC",
  "SE",
  "LTD",
  "LIMITED",
  "SRL",
  "SAS",
  "SNC",
  "SA",
  "S A",
  "IN ITALIA",
  "RAPPRESENTANZA",
  "RAPPRESENTANZA GEN PER L ITALIA",
  "RAPPRESENTANZA PER L ITALIA",
  "RAPPRESENTANZA IN ITALIA",
]);

export function normalizeNomeAnagrafica(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, "")
    .toUpperCase()
    .replace(/ASS\.?\s*NI\.?/g, "ASSICURAZIONI")
    .replace(/\bASSNI\b/g, "ASSICURAZIONI")
    .replace(/S\.\s*P\.\s*A\.?/g, "SPA")
    .replace(/\bSPA\b/g, "SPA")
    .replace(/S\.\s*R\.\s*L\.?/g, "SRL")
    .replace(/\bSRL\b/g, "SRL")
    .replace(/\bS\.\s*A\.\b/g, "SA")
    .replace(/LLOYD['’]?S/g, "LLOYDS")
    .replace(/&/g, "E")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sortedPrefixes(): { prefix: string; gruppo: string }[] {
  const out: { prefix: string; gruppo: string }[] = [];
  for (const def of BRAND_PREFIXES) {
    for (const prefix of def.prefixes) {
      out.push({ prefix: normalizeNomeAnagrafica(prefix), gruppo: def.gruppo });
    }
  }
  out.sort((a, b) => b.prefix.length - a.prefix.length);
  return out;
}

const PREFIX_INDEX = sortedPrefixes();

export function matchBrandPrefix(nome: string | null | undefined): { prefix: string; gruppo: string } | null {
  const n = normalizeNomeAnagrafica(nome);
  if (!n) return null;
  for (const row of PREFIX_INDEX) {
    if (n === row.prefix || n.startsWith(`${row.prefix} `)) return row;
  }
  return null;
}

export function isEmptyAgencyRemainder(remainder: string | null | undefined): boolean {
  const n = normalizeNomeAnagrafica(remainder);
  if (EMPTY_REMAINDER.has(n)) return true;
  const stripped = n
    .replace(/\bDIREZIONE\b/g, " ")
    .replace(/\bITALIAN BRANCH\b/g, " ")
    .replace(/\bIN ITALIA\b/g, " ")
    .replace(/\bRAPPRESENTANZA\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return !stripped || EMPTY_REMAINDER.has(stripped);
}

function extractAgencyOriginal(nome: string, remainderNorm: string): string {
  if (!remainderNorm) return "";
  const first = remainderNorm.split(" ")[0];
  const rx = new RegExp(`(?:^|[\\s\\-–/,.])(${escapeRegExp(first)}\\b.*)`, "i");
  const m = nome.match(rx);
  const raw = (m?.[1] || remainderNorm).replace(/^[\s\-–/.]+/, "").trim();
  return raw.replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitDashedNome(nome: string): { left: string; right: string } | null {
  const parts = String(nome).split(/\s+[-–]\s+/);
  if (parts.length < 2) return null;
  const left = parts[0].trim();
  const right = parts.slice(1).join(" - ").trim();
  if (!left || !right) return null;
  return { left, right };
}

export function splitCompagniaAgenzia(
  nome: string | null | undefined,
  tipo?: string | null,
): SplitCompagniaAgenzia {
  const raw = String(nome ?? "").replace(/\s+/g, " ").trim();
  if (!raw) {
    return { brand: null, gruppo: null, agenzia: null, esito: "sconosciuta", motivo: "Nome vuoto" };
  }

  if ((tipo || "").toLowerCase() === "direzione") {
    const brand = matchBrandPrefix(raw);
    return {
      brand: brand?.prefix ?? null,
      gruppo: brand?.gruppo ?? null,
      agenzia: null,
      esito: "direzione",
      motivo: brand ? `Direzione collegata a ${brand.gruppo}` : "Direzione senza brand noto",
    };
  }

  const dashed = splitDashedNome(raw);
  if (dashed) {
    const leftBrand = matchBrandPrefix(dashed.left);
    const rightBrand = matchBrandPrefix(dashed.right);
    if (rightBrand && !leftBrand) {
      return {
        brand: rightBrand.prefix,
        gruppo: rightBrand.gruppo,
        agenzia: dashed.left,
        esito: "gia_agenzia",
        motivo: `Agenzia già in testa, compagnia ${rightBrand.gruppo}`,
      };
    }
    if (leftBrand && !rightBrand) {
      const leftRest = normalizeNomeAnagrafica(dashed.left).slice(leftBrand.prefix.length).trim();
      if (!leftRest || leftRest === "ASSICURAZIONI") {
        return {
          brand: leftBrand.prefix,
          gruppo: leftBrand.gruppo,
          agenzia: dashed.right,
          esito: "agenzia_da_brand",
          motivo: `${leftBrand.gruppo} → ${dashed.right}`,
        };
      }
      if (/\b(SPA|SRL|SAS|SNC|SA|ITALIA)\b/.test(leftRest)) {
        return {
          brand: leftBrand.prefix,
          gruppo: leftBrand.gruppo,
          agenzia: null,
          esito: "solo_compagnia",
          motivo: `Anagrafica ${leftBrand.gruppo} con mandato extra non spezzato`,
        };
      }
    }
  }

  const brand = matchBrandPrefix(raw);
  if (!brand) {
    return { brand: null, gruppo: null, agenzia: null, esito: "sconosciuta", motivo: "Brand non riconosciuto in testa" };
  }

  const norm = normalizeNomeAnagrafica(raw);
  const remainderNorm = norm.slice(brand.prefix.length).trim();
  if (isEmptyAgencyRemainder(remainderNorm)) {
    return {
      brand: brand.prefix,
      gruppo: brand.gruppo,
      agenzia: null,
      esito: "solo_compagnia",
      motivo: `Anagrafica compagnia ${brand.gruppo}, senza sede/agenzia`,
    };
  }

  const agenzia = extractAgencyOriginal(raw, remainderNorm);
  return {
    brand: brand.prefix,
    gruppo: brand.gruppo,
    agenzia,
    esito: "agenzia_da_brand",
    motivo: `${brand.gruppo} → ${agenzia}`,
  };
}

export function generateItalianIban(seed: string): string {
  let n = 0;
  for (const ch of String(seed)) n = (n * 33 + ch.charCodeAt(0)) >>> 0;
  const account = String(100000000000 + (n % 899999999999)).slice(-12);
  const bban = `X0306905046${account}`;
  const expanded = [...`${bban}IT00`]
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 65 ? String(code - 55) : ch;
    })
    .join("");
  let remainder = 0;
  for (const ch of expanded) remainder = (remainder * 10 + Number(ch)) % 97;
  const check = String(98 - remainder).padStart(2, "0");
  return `IT${check}${bban}`;
}
