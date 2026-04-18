import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { SCHEMA_CONTEXT } from "./schema-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYSTEM_PROMPT = `Sei un assistente IA per un broker assicurativo italiano (CBnet/ConsulNet).
Rispondi in italiano, in modo conciso e professionale.

Hai accesso al database via il tool "query_database". USALO ogni volta che la domanda
riguarda dati concreti (clienti, polizze, sinistri, scadenze, provvigioni, contabilità).
Le query rispettano automaticamente i permessi dell'utente: se non vede nulla, dillo
("Non risulta alcun dato visibile per questa ricerca.").

Quando ricevi i risultati, formula una risposta naturale citando i dati rilevanti
(numero polizza, date in formato gg/mm/aaaa, importi in EUR). Usa elenchi puntati o
tabelle markdown solo se ci sono più di 3 risultati. Massimo 3 chiamate al tool per domanda.

${SCHEMA_CONTEXT}`;

const tools = [
  {
    type: "function",
    function: {
      name: "query_database",
      description:
        "Esegue una query SELECT in sola lettura sul database. Restituisce JSON. Massimo 50 righe.",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description:
              "Query PostgreSQL SELECT (o WITH ... SELECT). Niente punto e virgola finale, niente DDL/DML.",
          },
          purpose: {
            type: "string",
            description: "Breve descrizione di cosa stai cercando (per logging).",
          },
        },
        required: ["sql"],
        additionalProperties: false,
      },
    },
  },
];

async function callGemini(messages: any[]) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      tools,
      tool_choice: "auto",
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Response(
      JSON.stringify({
        error:
          resp.status === 429
            ? "Limite richieste IA superato, riprova fra poco."
            : resp.status === 402
            ? "Crediti IA esauriti. Aggiungi credito al workspace Lovable."
            : `Errore AI gateway: ${text}`,
      }),
      { status: resp.status === 429 || resp.status === 402 ? resp.status : 500 },
    );
  }
  return await resp.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const userMessages: Array<{ role: string; content: string }> = body.messages ?? [];
    if (!Array.isArray(userMessages) || userMessages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...userMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const toolCallsLog: Array<{ sql: string; purpose?: string; rows?: number; error?: string }> = [];

    // Tool-call loop, max 3 round trips
    for (let i = 0; i < 4; i++) {
      let aiResp;
      try {
        aiResp = await callGemini(messages);
      } catch (e) {
        if (e instanceof Response) {
          const txt = await e.text();
          return new Response(txt, {
            status: e.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw e;
      }

      const choice = aiResp.choices?.[0];
      const msg = choice?.message;
      if (!msg) {
        return new Response(JSON.stringify({ error: "Risposta IA vuota" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toolCalls = msg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        // Final answer
        return new Response(
          JSON.stringify({
            content: msg.content ?? "",
            tool_calls: toolCallsLog,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Execute tool calls
      messages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        const fnName = tc.function?.name;
        let argsRaw = tc.function?.arguments ?? "{}";
        let args: any = {};
        try {
          args = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
        } catch {
          args = {};
        }

        if (fnName !== "query_database") {
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: `Tool sconosciuto: ${fnName}` }),
          });
          continue;
        }

        const sql: string = args.sql ?? "";
        const purpose: string | undefined = args.purpose;
        let rows: unknown = null;
        let error: string | null = null;

        try {
          const { data, error: rpcError } = await supabase.rpc("ai_exec_select", {
            query_text: sql,
          });
          if (rpcError) {
            error = rpcError.message;
          } else {
            rows = data;
          }
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }

        const rowCount = Array.isArray(rows) ? rows.length : 0;
        toolCallsLog.push({ sql, purpose, rows: rowCount, error: error ?? undefined });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(
            error
              ? { error }
              : { rows: Array.isArray(rows) ? rows.slice(0, 50) : rows, count: rowCount },
          ),
        });
      }
    }

    return new Response(
      JSON.stringify({
        content:
          "Mi dispiace, la richiesta è troppo complessa per essere risolta in pochi passi. Prova a riformularla in modo più specifico.",
        tool_calls: toolCallsLog,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
