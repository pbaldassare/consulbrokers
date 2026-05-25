// Edge function: parse-polizza-completa
// Estrae dati completi di una scheda di polizza italiana (qualsiasi ramo) via Gemini.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOL = {
  name: "extract_polizza_completa",
  description:
    "Estrae i dati completi di una scheda di polizza assicurativa italiana: contraente, compagnia, dati polizza, premi, ramo, garanzie.",
  parameters: {
    type: "object",
    properties: {
      // Compagnia / intermediario
      compagnia: { type: "string", description: "Denominazione completa della compagnia assicuratrice (es. 'AmTrust Assicurazioni S.p.A.')" },
      intermediario: { type: "string", description: "Nome del broker/intermediario se indicato (es. 'CONSULBROKERS S.P.A.')" },
      codice_nodo: { type: "string", description: "Codice nodo dell'intermediario" },

      // Contraente
      contraente_nome: { type: "string", description: "Nome e cognome OPPURE ragione sociale del contraente" },
      contraente_codice_fiscale: { type: "string", description: "Codice fiscale del contraente (16 caratteri o 11 per persona giuridica)" },
      contraente_partita_iva: { type: "string" },
      contraente_indirizzo: { type: "string", description: "Indirizzo (via e numero civico)" },
      contraente_comune: { type: "string" },
      contraente_provincia: { type: "string", description: "Sigla provincia (2 lettere)" },
      contraente_cap: { type: "string" },
      contraente_nazione: { type: "string", description: "Codice ISO nazione (es. IT)" },
      contraente_email: { type: "string" },
      contraente_telefono: { type: "string" },

      // Polizza
      numero_polizza: { type: "string" },
      polizza_sostituita: { type: "string", description: "Numero della polizza sostituita se presente" },
      prodotto: { type: "string", description: "Nome/descrizione del prodotto assicurativo (es. 'AmTrust Colpagrave Extra Ed.02/2023')" },
      ramo_descrizione: { type: "string", description: "Descrizione del ramo assicurativo dedotto dal documento (es. 'RC Professionale Medico', 'RCA Auto', 'Incendio Fabbricato')" },

      // Periodo
      decorrenza: { type: "string", description: "Data inizio copertura YYYY-MM-DD" },
      scadenza: { type: "string", description: "Data fine copertura YYYY-MM-DD" },
      prossima_quietanza: { type: "string", description: "Data prossima quietanza YYYY-MM-DD" },
      frazionamento: { type: "string", description: "Annuale | Semestrale | Quadrimestrale | Trimestrale | Mensile" },
      tacito_rinnovo: { type: "boolean" },

      // Premi alla firma
      premio_firma_netto: { type: "number" },
      premio_firma_accessori: { type: "number" },
      premio_firma_imposte: { type: "number" },
      premio_firma_lordo: { type: "number" },

      // Premi rate future / quietanza
      premio_quietanza_netto: { type: "number" },
      premio_quietanza_accessori: { type: "number" },
      premio_quietanza_imposte: { type: "number" },
      premio_quietanza_lordo: { type: "number" },

      // RCA-specifici (opzionali)
      targa: { type: "string" },

      // Garanzie operanti (ogni voce diventerà una riga "Sottoramo" nel form manuale)
      garanzie: {
        type: "array",
        description:
          "Elenco voci di garanzia OPERANTI con premio (flag = SI / Operante). Ogni voce verrà mappata a un Sottoramo del catalogo. Ignora garanzie non attive.",
        items: {
          type: "object",
          properties: {
            descrizione: { type: "string", description: "Descrizione della garanzia esattamente come sul documento" },
            codice_sottoramo: {
              type: "string",
              description:
                "OBBLIGATORIO mappare al `codice` di uno dei sottorami ammessi forniti nel prompt utente. Se non sei sicuro, OMETTI il campo: non inventare codici.",
            },
            premio_netto: { type: "number" },
            premio_imposte: { type: "number", description: "Imposte/tasse della singola voce, se indicate" },
            aliquota_tasse_pct: { type: "number", description: "Aliquota imposte % della voce (es. 13.5, 22.25)" },
          },
          required: ["descrizione"],
          additionalProperties: false,
        },
      },
    },
    required: ["numero_polizza"],
    additionalProperties: false,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const { fileBase64, mimeType, gruppo_ramo, sottorami_ammessi } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "fileBase64 e mimeType richiesti" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;

    // Contesto Ramo + sottorami ammessi (passati dalla UI quando l'utente sceglie il Ramo prima dell'upload)
    let ramoContext = "";
    if (gruppo_ramo && typeof gruppo_ramo === "object") {
      const gr = gruppo_ramo as { codice?: string; descrizione?: string };
      ramoContext +=
        `\n\nIl RAMO della polizza è già stato indicato dall'utente: ${gr.codice || ""} - ${gr.descrizione || ""}. ` +
        `NON cambiarlo: tutte le voci di garanzia devono appartenere a questo ramo.`;
    }
    if (Array.isArray(sottorami_ammessi) && sottorami_ammessi.length > 0) {
      const list = (sottorami_ammessi as Array<{ codice?: string; descrizione?: string }>)
        .map((s) => `  - ${s.codice} : ${s.descrizione}`)
        .join("\n");
      ramoContext +=
        `\n\nElenco SOTTORAMI AMMESSI (devi mappare ogni voce 'garanzie[].codice_sottoramo' SOLO a uno di questi codici. ` +
        `È LECITO e ATTESO riusare lo STESSO codice su più voci diverse del PDF — molte garanzie tecniche del PDF mappano sullo stesso sottoramo catalogo. ` +
        `Solo se davvero nessun codice è applicabile, OMETTI il campo).\n${list}`;

      // Regole di dominio (heuristics) per ramo ZQ — R.C.A. (auto/veicoli)
      const gr = (gruppo_ramo as any) || {};
      if ((gr.codice || "").toUpperCase() === "ZQ") {
        ramoContext +=
          `\n\nREGOLE DI MAPPING per ramo ZQ (R.C.A.):\n` +
          `- "Responsabilità civile auto", "RCA", "RC veicoli" → PI (autovetture) / QA (auto generica) / QC (autocarri) / QM (motoveicoli) — scegli in base al tipo veicolo.\n` +
          `- "Incendio", "Furto", "Incendio e Furto", "Rapina" → QI (INCENDIO/FURTO).\n` +
          `- "Eventi atmosferici", "Grandine", "Eventi naturali", "Eventi sociopolitici", "Atti vandalici", "Ricorso terzi da incendio" → DRA (AUTO RISCHI DIVERSI / A.R.D.).\n` +
          `- "Cristalli", "Rottura cristalli" → EC (CRISTALLI).\n` +
          `- "Kasko", "Collisione", "Mini-kasko", "Garanzia collisione" → QK (KASKO).\n` +
          `- "Tutela legale", "Assistenza stradale", "Infortuni del conducente" → NON hanno sottoramo dedicato in ZQ: OMETTI codice_sottoramo (l'utente lo sceglierà).\n` +
          `Riusa pure più volte lo stesso codice (es. più voci A.R.D. → tutte DRA).`;
      }
    }

    const messages = [
      {
        role: "system",
        content:
          "Sei un esperto di polizze assicurative italiane. Estrai TUTTI i dati strutturati dalla scheda di polizza fornita. " +
          "Date in formato YYYY-MM-DD. Importi numerici (es. 1234.56 — usa il punto come separatore decimale). " +
          "Per le garanzie, includi SOLO quelle effettivamente operanti (flag SI/Operante). " +
          "Codice fiscale e partita IVA in maiuscolo. Provincia in 2 lettere maiuscole. " +
          "Se un campo non è chiaramente presente sul documento, ometterlo (non inventare).",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Analizza questa scheda di polizza ed estrai i dati richiesti." + ramoContext },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [{ type: "function", function: TOOL }],
        tool_choice: { type: "function", function: { name: TOOL.name } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      if (resp.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit AI superato. Riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (resp.status === 402)
        return new Response(
          JSON.stringify({ error: "Crediti AI esauriti. Aggiungi credito al workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      return new Response(JSON.stringify({ error: "Errore AI gateway" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const args = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: any = {};
    try {
      parsed = typeof args === "string" ? JSON.parse(args) : args ?? {};
    } catch (e) {
      console.error("parse args fail", e, args);
    }

    // Heuristic fallback: riempi i codice_sottoramo rimasti vuoti usando keyword → codice (solo se ammessi).
    try {
      const ammessi = new Set<string>(
        (Array.isArray(sottorami_ammessi) ? sottorami_ammessi : [])
          .map((s: any) => String(s?.codice || "").toUpperCase())
          .filter(Boolean),
      );
      const gr = (gruppo_ramo as any) || {};
      const isZQ = String(gr?.codice || "").toUpperCase() === "ZQ";
      if (isZQ && Array.isArray(parsed?.garanzie)) {
        const rules: Array<{ re: RegExp; code: string }> = [
          { re: /cristall/i, code: "EC" },
          { re: /kasko|collision/i, code: "QK" },
          { re: /incend|furt|rapin/i, code: "QI" },
          { re: /grandin|atmosfer|sociopolit|vandal|ricorso/i, code: "DRA" },
          { re: /a\.?\s?r\.?\s?d\.?/i, code: "DRA" },
          { re: /autocarr/i, code: "QC" },
          { re: /motociclo|motoveicolo|moto/i, code: "QM" },
          { re: /responsabilit|r\.?c\.?a|rca|r\.?c\.?\s*auto/i, code: "PI" },
        ];
        parsed.garanzie = parsed.garanzie.map((g: any) => {
          if (g?.codice_sottoramo) return g;
          const desc = String(g?.descrizione || "");
          for (const r of rules) {
            if (r.re.test(desc) && ammessi.has(r.code)) {
              return { ...g, codice_sottoramo: r.code };
            }
          }
          return g;
        });
      }
    } catch (e) {
      console.warn("heuristic fallback fail", e);
    }

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-polizza-completa error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
