import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1) Gruppi Ramo
    const gruppiRamo = [
      { codice: "INC", descrizione: "INCENDIO" },
      { codice: "INF", descrizione: "INFORTUNI" },
      { codice: "RC", descrizione: "RESPONSABILITA' CIVILE" },
      { codice: "RCA", descrizione: "RCA / ARD" },
      { codice: "FUR", descrizione: "FURTO" },
      { codice: "VIT", descrizione: "VITA" },
      { codice: "TRA", descrizione: "TRASPORTI" },
      { codice: "CAU", descrizione: "CAUZIONI" },
      { codice: "CRE", descrizione: "CREDITO" },
      { codice: "DIV", descrizione: "DIVERSI" },
      { codice: "MAL", descrizione: "MALATTIA" },
      { codice: "ASS", descrizione: "ASSISTENZA" },
      { codice: "TLE", descrizione: "TUTELA LEGALE" },
      { codice: "NAU", descrizione: "CORPI NAUTICA" },
      { codice: "AVI", descrizione: "AVIAZIONE" },
      { codice: "AGR", descrizione: "AGRICOLTURA" },
    ];
    const { error: errGR } = await supabase.from("gruppi_ramo").upsert(gruppiRamo, { onConflict: "codice" });
    if (errGR) throw errGR;

    // Get gruppo IDs for rami FK
    const { data: gruppi } = await supabase.from("gruppi_ramo").select("id, codice");
    const gMap: Record<string, string> = {};
    for (const g of gruppi || []) gMap[g.codice] = g.id;

    // 2) Rami
    const rami = [
      // INCENDIO
      { codice: "INC-ORD", descrizione: "INCENDIO RISCHI ORDINARI", gruppo_ramo_id: gMap["INC"] },
      { codice: "INC-IND", descrizione: "INCENDIO INDUSTRIALE", gruppo_ramo_id: gMap["INC"] },
      { codice: "INC-PIC", descrizione: "INCENDIO PICCOLA INDUSTR.", gruppo_ramo_id: gMap["INC"] },
      { codice: "INC-RIS", descrizione: "INCENDIO RISCHI INDUSTR.", gruppo_ramo_id: gMap["INC"] },
      { codice: "INC-GAR", descrizione: "INCENDIO E GAR. ACC. P.A.", gruppo_ramo_id: gMap["INC"] },
      { codice: "INC-ENV", descrizione: "INCENDIO ELETTRONICA NON VINCOLATI", gruppo_ramo_id: gMap["INC"] },
      { codice: "INC-EVN", descrizione: "INCENDIO ELETTRONICA VINCOLATI", gruppo_ramo_id: gMap["INC"] },
      { codice: "INC-EXT", descrizione: "INCENDIO EXT. COVERAGE", gruppo_ramo_id: gMap["INC"] },
      { codice: "INC-FUR", descrizione: "INCENDIO/FURTO", gruppo_ramo_id: gMap["INC"] },
      { codice: "INC-FRK", descrizione: "INCENDIO/FURTO/KASKO", gruppo_ramo_id: gMap["INC"] },
      // INFORTUNI
      { codice: "INF-IND", descrizione: "INFORTUNI INDIVIDUALE", gruppo_ramo_id: gMap["INF"] },
      { codice: "INF-CUM", descrizione: "INFORTUNI CUMULATIVA", gruppo_ramo_id: gMap["INF"] },
      { codice: "INF-CON", descrizione: "INFORTUNI CONDUCENTE", gruppo_ramo_id: gMap["INF"] },
      { codice: "INF-SPO", descrizione: "INFORTUNI IND. SPORTIVI", gruppo_ramo_id: gMap["INF"] },
      // RC
      { codice: "RC-VOL", descrizione: "R.C. VOLONTARI", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-RCO", descrizione: "R.C.O.", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-RCT", descrizione: "R.C.T./O. ESCLUSO TASSE", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-TRCO", descrizione: "R.C.T./R.C.O", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-TLE", descrizione: "RC + TUTELA LEGALE", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-CEN", descrizione: "RC CENTRALE ENERGIA", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-DRO", descrizione: "RC DRONE", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-INQ", descrizione: "RC INQUINAMENTO", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-PCG", descrizione: "RC PATRIMONIALE COLPA GRAVE", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-POQ", descrizione: "RC POSTUMA QUINQUENNALE", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-PRP", descrizione: "RC PROF. POSTUMA", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-NAU", descrizione: "RC+CORPI NAUTICA", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-PAT", descrizione: "RCTO + RC PATRIMONIALE", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-CVT", descrizione: "RESP. CIVILE VERSO TERZI", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-PIO", descrizione: "RISCHIO PIOGGIA", gruppo_ramo_id: gMap["RC"] },
      { codice: "RC-POL", descrizione: "RISCHIO POLITICO", gruppo_ramo_id: gMap["RC"] },
      // RCA
      { codice: "RCA-ARD", descrizione: "RCA & ARD", gruppo_ramo_id: gMap["RCA"] },
      { codice: "RCA-AUT", descrizione: "RCA AUTO", gruppo_ramo_id: gMap["RCA"] },
      { codice: "RCA-MOT", descrizione: "RCA MOTO", gruppo_ramo_id: gMap["RCA"] },
      { codice: "RCA-CIC", descrizione: "RCA CICLOMOTORE", gruppo_ramo_id: gMap["RCA"] },
      // FURTO
      { codice: "FUR-ORD", descrizione: "FURTO RISCHI ORDINARI", gruppo_ramo_id: gMap["FUR"] },
      { codice: "FUR-IND", descrizione: "FURTO INDUSTRIALE", gruppo_ramo_id: gMap["FUR"] },
      // VITA
      { codice: "VIT-IND", descrizione: "VITA INDIVIDUALE", gruppo_ramo_id: gMap["VIT"] },
      { codice: "VIT-COL", descrizione: "VITA COLLETTIVA", gruppo_ramo_id: gMap["VIT"] },
      { codice: "VIT-TFR", descrizione: "VITA TFR", gruppo_ramo_id: gMap["VIT"] },
      // TRASPORTI
      { codice: "TRA-MER", descrizione: "TRASPORTI MERCI", gruppo_ramo_id: gMap["TRA"] },
      { codice: "TRA-COR", descrizione: "TRASPORTI CORPI", gruppo_ramo_id: gMap["TRA"] },
      // CAUZIONI
      { codice: "CAU-DEF", descrizione: "CAUZIONI DEFINITIVE", gruppo_ramo_id: gMap["CAU"] },
      { codice: "CAU-PRO", descrizione: "CAUZIONI PROVVISORIE", gruppo_ramo_id: gMap["CAU"] },
      // MALATTIA
      { codice: "MAL-IND", descrizione: "MALATTIA INDIVIDUALE", gruppo_ramo_id: gMap["MAL"] },
      { codice: "MAL-COL", descrizione: "MALATTIA COLLETTIVA", gruppo_ramo_id: gMap["MAL"] },
      // ASSISTENZA
      { codice: "ASS-VIA", descrizione: "ASSISTENZA VIAGGIO", gruppo_ramo_id: gMap["ASS"] },
      { codice: "ASS-DOM", descrizione: "ASSISTENZA DOMICILIARE", gruppo_ramo_id: gMap["ASS"] },
      // TUTELA LEGALE
      { codice: "TLE-GEN", descrizione: "TUTELA LEGALE GENERALE", gruppo_ramo_id: gMap["TLE"] },
      { codice: "TLE-CIR", descrizione: "TUTELA LEGALE CIRCOLAZIONE", gruppo_ramo_id: gMap["TLE"] },
      // DIVERSI
      { codice: "DIV-ALL", descrizione: "ALL RISKS", gruppo_ramo_id: gMap["DIV"] },
      { codice: "DIV-ELE", descrizione: "ELETTRONICA", gruppo_ramo_id: gMap["DIV"] },
      { codice: "DIV-CRI", descrizione: "CRISTALLI", gruppo_ramo_id: gMap["DIV"] },
      { codice: "DIV-KAS", descrizione: "KASKO", gruppo_ramo_id: gMap["DIV"] },
      { codice: "DIV-GLO", descrizione: "GLOBALE FABBRICATI", gruppo_ramo_id: gMap["DIV"] },
      { codice: "DIV-MUL", descrizione: "MULTIRISCHI", gruppo_ramo_id: gMap["DIV"] },
    ];
    const { error: errR } = await supabase.from("rami").upsert(rami, { onConflict: "codice" });
    if (errR) throw errR;

    // 3) Gruppi Statistici
    const gruppiStat = [
      { codice: "PA", descrizione: "PUBBLICA AMMINISTRAZIONE" },
      { codice: "ENTI", descrizione: "ENTI / FONDAZIONI" },
      { codice: "SOC", descrizione: "SOCIETA'" },
      { codice: "PRIV", descrizione: "PRIVATI" },
      { codice: "PROF", descrizione: "PROFESSIONISTI" },
      { codice: "COOP", descrizione: "COOPERATIVE" },
      { codice: "ASS", descrizione: "ASSOCIAZIONI" },
      { codice: "SCUO", descrizione: "SCUOLE / UNIVERSITA'" },
      { codice: "SAN", descrizione: "SANITARIO" },
      { codice: "AGR", descrizione: "AGRICOLTURA" },
      { codice: "COM", descrizione: "COMMERCIO" },
      { codice: "IND", descrizione: "INDUSTRIA" },
      { codice: "ART", descrizione: "ARTIGIANATO" },
      { codice: "TRA", descrizione: "TRASPORTI" },
      { codice: "TUR", descrizione: "TURISMO / ALBERGHI" },
      { codice: "EDI", descrizione: "EDILIZIA" },
    ];
    const { error: errGS } = await supabase.from("gruppi_statistici").upsert(gruppiStat, { onConflict: "codice" });
    if (errGS) throw errGS;

    // 4) Gruppi Compagnia
    const gruppiComp = [
      { codice: "ALL", descrizione: "ALLIANZ" },
      { codice: "AXA", descrizione: "AXA" },
      { codice: "GEN", descrizione: "GENERALI" },
      { codice: "UNI", descrizione: "UNIPOL" },
      { codice: "RAS", descrizione: "REALE MUTUA" },
      { codice: "ZUR", descrizione: "ZURICH" },
      { codice: "CAT", descrizione: "CATTOLICA" },
      { codice: "VIT", descrizione: "VITTORIA" },
      { codice: "SAR", descrizione: "SARA ASSICURAZIONI" },
      { codice: "INT", descrizione: "INTESA SANPAOLO" },
      { codice: "HDI", descrizione: "HDI ASSICURAZIONI" },
      { codice: "AMI", descrizione: "AMISSIMA" },
      { codice: "INE", descrizione: "ITAS MUTUA" },
      { codice: "ATL", descrizione: "LLOYD'S" },
    ];
    const { error: errGC } = await supabase.from("gruppi_compagnia").upsert(gruppiComp, { onConflict: "codice" });
    if (errGC) throw errGC;

    // 5) Tipi Mandatario
    const tipiMand = [
      { codice: "AGE", descrizione: "AGENTE" },
      { codice: "BRO", descrizione: "BROKER" },
      { codice: "SUB", descrizione: "SUB-AGENTE" },
      { codice: "DIR", descrizione: "DIRETTO" },
      { codice: "MAN", descrizione: "MANDATARIO" },
      { codice: "DEL", descrizione: "DELEGATO" },
    ];
    const { error: errTM } = await supabase.from("tipi_mandatario").upsert(tipiMand, { onConflict: "codice" });
    if (errTM) throw errTM;

    // 6) Tipi Rinnovo
    const tipiRinn = [
      { codice: "ANN-SCA", descrizione: "Annullare alla scadenza" },
      { codice: "CES-RIS", descrizione: "Cessato rischio (vendita)" },
      { codice: "COP-PRO", descrizione: "Copertura provvisoria" },
      { codice: "EME-RIN", descrizione: "EMESSO RINNOVO" },
      { codice: "POL-DIS", descrizione: "Polizza disdetta" },
      { codice: "POL-SOS", descrizione: "Polizza Sostituita" },
      { codice: "RIF-SCA", descrizione: "Riformare alla scadenza" },
      { codice: "SVI", descrizione: "Svincolo" },
      { codice: "TAC", descrizione: "Tacito rinnovo" },
      { codice: "TAC-MOD", descrizione: "Tacito rinnovo (da modif)" },
      { codice: "TRA-CBD", descrizione: "Trasferita a CBDigital" },
    ];
    const { error: errTR } = await supabase.from("tipi_rinnovo").upsert(tipiRinn, { onConflict: "codice" });
    if (errTR) throw errTR;

    // 7) Filiali
    const filiali = [
      { codice: "SEDE", descrizione: "Sede" },
      { codice: "AMB-DEMO", descrizione: "AMBIENTE DEMO" },
      { codice: "ASL-PUG", descrizione: "ASL PUGLIA" },
      { codice: "ASP-SIC", descrizione: "ASP SICILIA" },
      { codice: "CAVS-ME", descrizione: "CAVS MESSINA" },
      { codice: "CM-NAP", descrizione: "Città Metropolitana di Napoli" },
      { codice: "FIL-A1", descrizione: "Filiale A1" },
      { codice: "SEDI-SI", descrizione: "Sedi Sicilia" },
      { codice: "UF-PAR", descrizione: "Ufficio di Parma" },
      { codice: "UF-CAU", descrizione: "Ufficio Cauzioni" },
      { codice: "UF-BER", descrizione: "Ufficio di Bergamo" },
      { codice: "UF-BOL", descrizione: "Ufficio di Bologna" },
      { codice: "UF-CAM", descrizione: "Ufficio di Campobasso" },
      { codice: "UF-CAT", descrizione: "Ufficio di Catania" },
      { codice: "UF-FIR", descrizione: "Ufficio di Firenze" },
      { codice: "UF-GEN", descrizione: "Ufficio di Genova" },
    ];
    const { error: errFI } = await supabase.from("filiali").upsert(filiali, { onConflict: "codice" });
    if (errFI) throw errFI;

    // 8) Compagnie
    const compagnieData = [
      { nome: "ALLIANZ S.p.A.", codice: "ALL", gruppo_compagnia: "ALLIANZ", attiva: true },
      { nome: "AXA ASSICURAZIONI", codice: "AXA", gruppo_compagnia: "AXA", attiva: true },
      { nome: "GENERALI ITALIA S.p.A.", codice: "GEN", gruppo_compagnia: "GENERALI", attiva: true },
      { nome: "UNIPOL SAI", codice: "UNI", gruppo_compagnia: "UNIPOL", attiva: true },
      { nome: "REALE MUTUA", codice: "RLM", gruppo_compagnia: "REALE MUTUA", attiva: true },
      { nome: "ZURICH INSURANCE", codice: "ZUR", gruppo_compagnia: "ZURICH", attiva: true },
      { nome: "CATTOLICA ASSICURAZIONI", codice: "CAT", gruppo_compagnia: "CATTOLICA", attiva: true },
      { nome: "VITTORIA ASSICURAZIONI", codice: "VIT", gruppo_compagnia: "VITTORIA", attiva: true },
      { nome: "SARA ASSICURAZIONI", codice: "SAR", gruppo_compagnia: "SARA ASSICURAZIONI", attiva: true },
      { nome: "HDI ASSICURAZIONI", codice: "HDI", gruppo_compagnia: "HDI ASSICURAZIONI", attiva: true },
      { nome: "AMISSIMA ASSICURAZIONI", codice: "AMI", gruppo_compagnia: "AMISSIMA", attiva: true },
      { nome: "ITAS MUTUA", codice: "ITA", gruppo_compagnia: "ITAS MUTUA", attiva: true },
      { nome: "LLOYD'S OF LONDON", codice: "LLO", gruppo_compagnia: "LLOYD'S", attiva: true },
      { nome: "GROUPAMA ASSICURAZIONI", codice: "GRP", gruppo_compagnia: "GROUPAMA", attiva: true },
      { nome: "HELVETIA ITALIA", codice: "HEL", gruppo_compagnia: "HELVETIA", attiva: true },
    ];
    const { error: errCO } = await supabase.from("compagnie").upsert(compagnieData, { onConflict: "codice", ignoreDuplicates: false });
    if (errCO) throw errCO;

    // 9) Categorie Prodotto
    const categorieData = [
      { nome: "Auto" },
      { nome: "Vita" },
      { nome: "Infortuni e Malattia" },
      { nome: "Incendio e Danni" },
      { nome: "RC Professionale" },
      { nome: "RC Generale" },
      { nome: "Cauzioni" },
      { nome: "Trasporti" },
      { nome: "Multirischi" },
      { nome: "Tutela Legale" },
      { nome: "Previdenza" },
      { nome: "Assistenza" },
    ];
    const { error: errCA } = await supabase.from("categorie_prodotto").upsert(categorieData, { onConflict: "nome" });
    if (errCA) throw errCA;

    return new Response(JSON.stringify({
      success: true,
      counts: {
        gruppi_ramo: gruppiRamo.length,
        rami: rami.length,
        gruppi_statistici: gruppiStat.length,
        gruppi_compagnia: gruppiComp.length,
        tipi_mandatario: tipiMand.length,
        tipi_rinnovo: tipiRinn.length,
        filiali: filiali.length,
        compagnie: compagnieData.length,
        categorie_prodotto: categorieData.length,
      }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
