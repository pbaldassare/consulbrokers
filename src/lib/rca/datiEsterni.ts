import type { RcaPreventivoForm } from "@/lib/rca/preventivi";

export type AtrRca = {
  cu?: string;
  cu_originaria?: string;
  compagnia?: string;
  scadenza?: string;
  sinistri?: unknown;
  anni?: unknown;
  [key: string]: unknown;
};

export type DatiRcaEsterni = {
  fonte: string;
  interrogatoIl: string;
  brand?: string;
  model?: string;
  plate?: string;
  registrationDate?: string;
  value?: number;
  cu?: string;
  currentProvider?: string;
  insuranceExpire?: string;
  atr?: AtrRca;
  raw?: Record<string, unknown>;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asText(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function pickText(obj: Record<string, unknown> | null, keys: string[]): string {
  if (!obj) return "";
  for (const key of keys) {
    const t = asText(obj[key]);
    if (t) return t;
  }
  return "";
}

function pickNum(obj: Record<string, unknown> | null, keys: string[]): number | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const n = Number(obj[key]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

export function labelFonteDatiEsterni(fonte?: string | null): string {
  const f = String(fonte || "").toLowerCase();
  if (f.includes("euroherc") && f.includes("ania")) return "Euroherc / ANIA";
  if (f.includes("euroherc")) return "Euroherc";
  if (f.includes("ania")) return "ANIA";
  if (f.includes("assicurapp")) return "Assicurapp";
  return fonte || "Fonte esterna";
}

export function riepilogoAttestato(atr?: AtrRca | null, cu?: string | null): string {
  if (!atr && !cu) return "";
  const parti: string[] = [];
  const classe = cu || atr?.cu;
  if (classe) parti.push(`CU ${classe}`);
  if (atr?.cu_originaria && atr.cu_originaria !== classe) parti.push(`CU orig. ${atr.cu_originaria}`);
  if (atr?.compagnia) parti.push(String(atr.compagnia));
  if (atr?.scadenza) parti.push(`scad. ${atr.scadenza}`);
  return parti.join(" · ");
}

/** Normalizza payload Assicurapp / ANIA / Euroherc in un unico oggetto. */
export function normalizeDatiRcaEsterni(
  payload: unknown,
  opts: { fonte?: string; interrogatoIl?: string } = {},
): DatiRcaEsterni | null {
  const root = asRecord(payload);
  if (!root) return null;
  const nested =
    asRecord(root.dati) ||
    asRecord(root.data) ||
    asRecord(root.result) ||
    asRecord(root.vehicle_data) ||
    asRecord(root.vehicle) ||
    root;
  const quoteData = asRecord(root.quote_data) || asRecord(nested.quote_data);
  const insurance =
    asRecord(root.insurance) ||
    asRecord(nested.insurance) ||
    (quoteData ? asRecord(quoteData.insurance) : null);
  const atrRaw =
    asRecord(root.atr) ||
    asRecord(root.attestato) ||
    asRecord(insurance?.atr) ||
    asRecord(nested.atr) ||
    asRecord(nested.attestato) ||
    null;
  const cu = pickText(insurance, ["cu", "CU", "classe_cu", "bonus_malus"])
    || pickText(atrRaw, ["cu", "CU", "classe", "classe_cu"])
    || pickText(nested, ["cu", "CU", "classe_bm", "bonus_malus"]);
  const brand = pickText(nested, ["brand", "marca", "make"]).toUpperCase();
  const model = pickText(nested, ["model", "modello"]).toUpperCase();
  const plate = pickText(nested, ["plate", "targa", "license_plate"]).toUpperCase()
    || pickText(root, ["plate", "targa"]).toUpperCase();
  const currentProvider = pickText(insurance, ["current_insurance_provider", "compagnia", "provider"])
    || pickText(atrRaw, ["compagnia", "company"])
    || pickText(nested, ["compagnia", "current_insurance_provider"]);
  const insuranceExpire = pickText(insurance, ["insurance_expire", "scadenza", "expire"])
    || pickText(atrRaw, ["scadenza", "expire"])
    || pickText(nested, ["insurance_expire", "scadenza"]);
  const registrationDate = pickText(nested, ["registration_date", "data_immatricolazione", "immatricolazione"]);
  const value = pickNum(nested, ["value", "valore", "valore_veicolo"]);
  const hasAny = !!(brand || model || cu || currentProvider || insuranceExpire || atrRaw || plate);
  if (!hasAny) return null;
  const atr: AtrRca | undefined = atrRaw || cu
    ? { ...(atrRaw || {}), ...(cu ? { cu } : {}), ...(currentProvider ? { compagnia: currentProvider } : {}) }
    : undefined;
  return {
    fonte: opts.fonte || asText(root.fonte) || asText(root.source) || "Euroherc / ANIA",
    interrogatoIl: opts.interrogatoIl || new Date().toISOString(),
    brand: brand || undefined,
    model: model || undefined,
    plate: plate || undefined,
    registrationDate: registrationDate || undefined,
    value,
    cu: cu || undefined,
    currentProvider: currentProvider || undefined,
    insuranceExpire: insuranceExpire || undefined,
    atr,
    raw: root,
  };
}

export function mergeDatiEsterniNelForm(
  form: RcaPreventivoForm,
  dati: DatiRcaEsterni | null | undefined,
): RcaPreventivoForm {
  if (!dati) return form;
  return {
    ...form,
    targa: form.targa || (dati.plate || ""),
    brand: form.brand || (dati.brand || ""),
    model: form.model || (dati.model || ""),
    value: form.value || (dati.value != null ? String(dati.value) : ""),
    currentProvider: form.currentProvider || (dati.currentProvider || ""),
    insuranceExpire: form.insuranceExpire || (dati.insuranceExpire || ""),
    cu: dati.cu || form.cu,
    atr: dati.atr || form.atr,
    fonteDati: dati.fonte || form.fonteDati,
    datiEsterniIl: dati.interrogatoIl || form.datiEsterniIl,
  };
}

export function hasDatiEsterniUtili(dati: DatiRcaEsterni | null | undefined): boolean {
  if (!dati) return false;
  return !!(dati.cu || dati.atr || dati.brand || dati.model || dati.currentProvider || dati.insuranceExpire);
}
