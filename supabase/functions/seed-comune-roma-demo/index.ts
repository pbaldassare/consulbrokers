// Provisioning demo Comune Roma + upload PDF placeholder anonimizzati
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLIENTE_ID = "e8f4a2b0-7c3d-4e1f-9a6b-2d4e8f1c0b5a";
const DEMO_EMAIL = "demo.comune.roma@consulbrokers.it";
const DEMO_PASSWORD = "Leone123!";
const DEMO_RAGIONE = "Comune Demo Roma Capitale";

function minimalPdfBytes(title: string): Uint8Array {
  const safe = title.replace(/[()\\]/g, " ").slice(0, 80);
  const body = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 80>>stream
BT /F1 11 Tf 72 720 Td (${safe}) Tj 0 -16 Td (Documento demo anonimizzato - CBnet) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
trailer<</Size 6/Root 1 0 R>>
startxref
0
%%EOF`;
  return new TextEncoder().encode(body);
}

const POLIZZE_PDF = [
  { numero: "DEMO-RM-2026-010", filename: "All_Risks_Comune_Demo.pdf", title: "All Risks Comune Demo" },
  { numero: "DEMO-RM-2026-011", filename: "Tutela_Legale_Demo.pdf", title: "Tutela Legale Demo" },
  { numero: "DEMO-RM-2026-012", filename: "Cyber_Risk_PA_Demo.pdf", title: "Cyber Risk PA Demo" },
  { numero: "DEMO-RM-2026-013", filename: "RCT-O_Ente_Demo.pdf", title: "RCT-O Ente Demo" },
  { numero: "DEMO-RM-2026-014", filename: "RCA_Parco_Veicoli_Demo.pdf", title: "RCA Parco Veicoli Demo" },
];

const CLIENTE_DOCS: { path: string; name: string; title: string }[] = [
  { path: "polizza_all_risks.pdf", name: "Polizza_All_Risks_Demo.pdf", title: "All Risks Demo" },
  { path: "polizza_rcto.pdf", name: "Polizza_RCT-O_Demo.pdf", title: "RCT-O Demo" },
  { path: "quietanza_rcp.pdf", name: "Quietanza_RC_Patrimoniale.pdf", title: "Quietanza RCP Demo" },
  { path: "privacy_gdpr.pdf", name: "Modulo_Privacy_GDPA_Ente.pdf", title: "Privacy Ente Demo" },
  { path: "circolare_2026.pdf", name: "Circolare_Premi_2026_Demo.pdf", title: "Circolare Premi Demo" },
];

const SINISTRO_DOCS = [
  "SIN-RM-2025-001",
  "SIN-RM-2025-002",
  "SIN-RM-2025-003",
  "SIN-RM-2025-004",
  "SIN-RM-2025-005",
  "SIN-RM-2025-006",
  "SIN-RM-2026-007",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const results: Record<string, unknown> = { steps: [] as unknown[] };

    const { data: cliente, error: cliErr } = await supabase
      .from("clienti")
      .select("id, email, ragione_sociale, user_id")
      .eq("id", CLIENTE_ID)
      .maybeSingle();
    if (cliErr || !cliente) {
      throw new Error(cliErr?.message || "Cliente demo non trovato — eseguire prima la migration seed_comune_roma_demo");
    }

    let userId = cliente.user_id as string | null;

    if (!userId) {
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { nome: DEMO_RAGIONE, cognome: "" },
      });

      if (authErr) {
        if (authErr.message?.includes("already been registered")) {
          const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
          const existing = listData?.users?.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);
          if (!existing) throw authErr;
          userId = existing.id;
          await supabase.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD, email_confirm: true });
        } else {
          throw authErr;
        }
      } else {
        userId = authData.user.id;
      }

      await supabase.from("profiles").upsert({
        id: userId,
        nome: DEMO_RAGIONE,
        cognome: "",
        email: DEMO_EMAIL,
        ruolo: "cliente",
        attivo: true,
      }, { onConflict: "id" });

      await supabase.from("user_roles").upsert({ user_id: userId, role: "cliente" }, { onConflict: "user_id,role" });

      await supabase.from("clienti").update({ user_id: userId, area_riservata_tipo: "completa" }).eq("id", CLIENTE_ID);
      (results.steps as unknown[]).push({ auth: "created", user_id: userId });
    } else {
      await supabase.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD, email_confirm: true });
      await supabase.from("profiles").upsert({
        id: userId,
        nome: DEMO_RAGIONE,
        cognome: "",
        email: DEMO_EMAIL,
        ruolo: "cliente",
        attivo: true,
      }, { onConflict: "id" });
      await supabase.from("user_roles").upsert({ user_id: userId, role: "cliente" }, { onConflict: "user_id,role" });
      (results.steps as unknown[]).push({ auth: "existing", user_id: userId });
    }

    const pdfPolizze: unknown[] = [];
    for (const p of POLIZZE_PDF) {
      const { data: titolo } = await supabase
        .from("titoli")
        .select("id")
        .eq("cliente_anagrafica_id", CLIENTE_ID)
        .eq("numero_titolo", p.numero)
        .maybeSingle();
      if (!titolo?.id) {
        pdfPolizze.push({ numero: p.numero, skip: "titolo non trovato" });
        continue;
      }
      const bytes = minimalPdfBytes(p.title);
      const path = `${titolo.id}/${p.filename}`;
      await supabase.storage.from("documenti_titoli").upload(path, bytes, { contentType: "application/pdf", upsert: true });
      const { data: existingDoc } = await supabase
        .from("documenti")
        .select("id")
        .eq("entita_tipo", "titolo")
        .eq("entita_id", titolo.id)
        .eq("nome_file", p.filename)
        .maybeSingle();
      if (!existingDoc) {
        await supabase.from("documenti").insert({
          entita_tipo: "titolo",
          entita_id: titolo.id,
          bucket_name: "documenti_titoli",
          path_storage: path,
          nome_file: p.filename,
          categoria: "polizza_originale",
          visibile_al_cliente: true,
        });
      }
      pdfPolizze.push({ numero: p.numero, titolo_id: titolo.id, uploaded: true });
    }

    const pdfCliente: unknown[] = [];
    for (const d of CLIENTE_DOCS) {
      const storagePath = `${CLIENTE_ID}/demo-comune-roma/${d.path}`;
      const bytes = minimalPdfBytes(d.title);
      const { error: upErr } = await supabase.storage
        .from("documenti_clienti")
        .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });
      pdfCliente.push({ file: d.name, uploaded: !upErr, error: upErr?.message });
    }

    const pdfSinistri: unknown[] = [];
    for (const num of SINISTRO_DOCS) {
      const { data: sin } = await supabase
        .from("sinistri")
        .select("id")
        .eq("cliente_anagrafica_id", CLIENTE_ID)
        .eq("numero_sinistro", num)
        .maybeSingle();
      if (!sin?.id) continue;
      const fname = `Denuncia_${num}.pdf`;
      const storagePath = `${CLIENTE_ID}/demo-comune-roma/sinistri/${num}_denuncia.pdf`;
      const bytes = minimalPdfBytes(`Denuncia ${num}`);
      await supabase.storage.from("documenti_clienti").upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });
      const { data: existingDoc } = await supabase
        .from("documenti")
        .select("id")
        .eq("entita_tipo", "sinistro")
        .eq("entita_id", sin.id)
        .eq("nome_file", fname)
        .maybeSingle();
      if (!existingDoc) {
        await supabase.from("documenti").insert({
          entita_tipo: "sinistro",
          entita_id: sin.id,
          bucket_name: "documenti_clienti",
          path_storage: storagePath,
          nome_file: fname,
          categoria: "sinistro",
          visibile_al_cliente: true,
        });
      }
      pdfSinistri.push({ numero: num, uploaded: true });
    }

    results.pdf_polizze = pdfPolizze;
    results.pdf_cliente = pdfCliente;
    results.pdf_sinistri = pdfSinistri;
    results.ok = true;
    results.email = DEMO_EMAIL;
    results.password = DEMO_PASSWORD;
    results.cliente_id = CLIENTE_ID;
    results.login_url = "https://cbnet.it/login";

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
