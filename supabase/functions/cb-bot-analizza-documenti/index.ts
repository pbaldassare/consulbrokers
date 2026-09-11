// Edge: analizza o confronta documenti CB Bot (testo già estratto o file in storage).
// I nomi dei motori IA non vanno esposti al client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAi, aiChatCompletions, extractMoonshotFileText, getAiConfig } from "../_shared/aiProvider.ts";

async function callText(messages: { role: string; content: string }[]): Promise<string> {
  const resp = await aiChatCompletions({ messages }, { signal: AbortSignal.timeout(50_000) });
  if (!resp.ok) {
    throw new Error(`Analisi non disponibile (${resp.status}).`);
  }
  const json = await resp.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_FILES = 5;
const MAX_TEXT = 80_000;
const MAX_COMPARE_TEXT = 40_000;
const BUCKET = "cb-bot-documenti";

type StorageRef = { path: string; name?: string; mime?: string };
type TestoDoc = { titolo: string; testo: string };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

async function extractText(
  bytes: Uint8Array,
  name: string,
  mime: string,
): Promise<string> {
  const lower = name.toLowerCase();
  const isText = mime.includes("text") || lower.endsWith(".txt") || lower.endsWith(".md");
  if (isText) {
    const t = bytesToUtf8(bytes).trim();
    if (t.length < 8) throw new Error(`Testo insufficiente in ${name}`);
    return t.slice(0, 200_000);
  }

  const cfg = getAiConfig();
  if (cfg.provider === "moonshot" && (mime.includes("pdf") || lower.endsWith(".pdf"))) {
    const text = await extractMoonshotFileText(toBase64(bytes), name);
    const trimmed = text.trim();
    if (trimmed.length < 40) throw new Error(`Impossibile leggere il testo di ${name}`);
    return trimmed.slice(0, 200_000);
  }

  throw new Error(`Formato non analizzabile: ${name}`);
}

const ANALISI_PROMPT = `Sei un analista di documenti assicurativi italiani per un broker.
Riassumi il documento in italiano, in sezioni chiare:
- Tipo di documento
- Compagnia / prodotto (se presenti)
- Oggetto e garanzie
- Massimali, franchigie, scoperti
- Esclusioni e limiti rilevanti
- Scadenze e obblighi
- Punti di attenzione per il broker
Non inventare dati assenti dal testo. Se il documento è illeggibile, dillo.`;

const CONFRONTO_PROMPT = `Sei un analista di documenti assicurativi italiani per un broker.
Confronta i documenti. Struttura la risposta in italiano:
- Sintesi di ciascun documento
- Garanzie presenti / assenti
- Massimali e limiti
- Esclusioni
- Franchigie e scoperti
- Gap e punti di attenzione
Cita sempre il nome del documento. Non inventare dati assenti.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json(401, { error: "Accesso non autorizzato" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) return json(401, { error: "Accesso non autorizzato" });

    const { data: profile } = await userClient
      .from("profiles")
      .select("ruolo")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.ruolo === "cliente" || profile?.ruolo === "prospect") {
      return json(403, { error: "Accesso non autorizzato" });
    }

    const body = await req.json();
    const mode = body?.mode === "compare" ? "compare" : "analyze";
    const storageRefs: StorageRef[] = Array.isArray(body?.storage_paths) ? body.storage_paths : [];
    const testoDocs: TestoDoc[] = Array.isArray(body?.documenti) ? body.documenti : [];
    const documentoIds: string[] = Array.isArray(body?.documento_ids) ? body.documento_ids : [];

    requireAi();
    const admin = createClient(supabaseUrl, service);

    const extracted: { titolo: string; testo: string; storage_path?: string }[] = [];

    for (const d of testoDocs) {
      const titolo = String(d?.titolo ?? "Documento").slice(0, 160);
      const testo = String(d?.testo ?? "").trim();
      if (testo.length >= 8) extracted.push({ titolo, testo: testo.slice(0, 200_000) });
    }

    if (documentoIds.length > 0) {
      const { data: rows, error } = await admin
        .from("cb_bot_documenti")
        .select("id, titolo, testo_estratto, storage_path, file_name, mime_type")
        .in("id", documentoIds.slice(0, MAX_FILES));
      if (error) throw error;
      for (const row of rows ?? []) {
        if (row.testo_estratto && String(row.testo_estratto).trim().length >= 8) {
          extracted.push({
            titolo: row.titolo || row.file_name,
            testo: String(row.testo_estratto),
            storage_path: row.storage_path,
          });
          continue;
        }
        if (!row.storage_path) continue;
        const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(row.storage_path);
        if (dlErr || !blob) return json(400, { error: `Impossibile leggere ${row.file_name}` });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const testo = await extractText(
          bytes,
          row.file_name,
          row.mime_type || "application/pdf",
        );
        extracted.push({ titolo: row.titolo || row.file_name, testo, storage_path: row.storage_path });
      }
    }

    for (const ref of storageRefs.slice(0, MAX_FILES)) {
      const path = String(ref.path ?? "").replace(/^\/+/, "");
      if (!path || path.includes("..")) return json(400, { error: "Percorso file non valido" });
      if (!path.startsWith(`${user.id}/`)) {
        return json(403, { error: "Percorso file non autorizzato" });
      }
      const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(path);
      if (dlErr || !blob) return json(400, { error: `Impossibile leggere ${ref.name || path}` });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const name = ref.name || path.split("/").pop() || "documento.pdf";
      const mime = ref.mime || (name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
      const testo = await extractText(bytes, name, mime);
      extracted.push({ titolo: name, testo, storage_path: path });
    }

    if (extracted.length === 0) {
      return json(400, { error: "Nessun documento da analizzare" });
    }
    if (extracted.length > MAX_FILES) {
      return json(400, { error: `Massimo ${MAX_FILES} documenti` });
    }

    if (mode === "compare") {
      if (extracted.length < 2) {
        return json(400, { error: "Per il confronto servono almeno due documenti" });
      }
      const blocchi = extracted
        .map((d, i) => {
          const testo = d.testo.slice(0, MAX_COMPARE_TEXT);
          return `### Documento ${i + 1}: ${d.titolo}\n${testo}`;
        })
        .join("\n\n");
      const confronto = await callText([
        { role: "system", content: CONFRONTO_PROMPT },
        { role: "user", content: `Confronta questi documenti.\n\n${blocchi}` },
      ]);
      return json(200, {
        ok: true,
        mode: "compare",
        confronto,
        documenti: extracted.map((d) => ({
          titolo: d.titolo,
          storage_path: d.storage_path,
          testo_estratto: d.testo.slice(0, MAX_TEXT),
        })),
      });
    }

    const analizzati = [];
    for (const d of extracted) {
      const analisi = await callText([
        { role: "system", content: ANALISI_PROMPT },
        {
          role: "user",
          content: `Analizza il documento «${d.titolo}».\n\n--- INIZIO DOCUMENTO ---\n${d.testo.slice(0, MAX_TEXT)}\n--- FINE DOCUMENTO ---`,
        },
      ]);
      analizzati.push({
        titolo: d.titolo,
        storage_path: d.storage_path,
        testo_estratto: d.testo.slice(0, MAX_TEXT),
        analisi,
      });
    }

    return json(200, { ok: true, mode: "analyze", documenti: analizzati });
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Analisi non riuscita";
    const hidden = /kimi|gemini|moonshot|moonshine|lovable|openai|gpt-|claude/i.test(raw)
      ? "Analisi non disponibile. Riprovare tra poco."
      : raw;
    console.error("cb-bot-analizza-documenti", raw);
    return json(500, { error: hidden });
  }
});
