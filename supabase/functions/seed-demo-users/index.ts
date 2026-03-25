import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEMO_USERS = [
  {
    email: "admin@demo-agenzia.it",
    password: "Demo2024!",
    profile: {
      nome: "Marco",
      cognome: "Bianchi",
      ruolo: "admin",
      descrizione: "Amministratore di sistema",
      indirizzo: "Via Roma 15",
      cap: "20121",
      citta: "Milano",
      provincia: "MI",
      telefono: "02-1234567",
      fax: "02-1234568",
      codice_fiscale: "BNCMRC80A01F205Z",
      nome_rui: "Marco Bianchi",
      data_iscrizione_rui: "2010-03-15",
      numero_rui: "A000123456",
      sezione_rui: "A",
      codice_contabile: "AMM001",
      percentuale_ra: 23.00,
      iban: "IT60X0542811101000000123456",
      intestatario_cc: "Marco Bianchi",
    },
  },
  {
    email: "ufficio1@demo-agenzia.it",
    password: "Demo2024!",
    profile: {
      nome: "Laura",
      cognome: "Rossi",
      ruolo: "ufficio",
      descrizione: "Responsabile sede Milano",
      indirizzo: "Via Montenapoleone 8",
      cap: "20121",
      citta: "Milano",
      provincia: "MI",
      telefono: "02-9876543",
      fax: "02-9876544",
      codice_fiscale: "RSSLRA85B41F205K",
      nome_rui: "Laura Rossi",
      data_iscrizione_rui: "2012-06-20",
      numero_rui: "A000234567",
      sezione_rui: "A",
      codice_contabile: "UFF001",
      percentuale_ra: 23.00,
      iban: "IT60X0542811101000000234567",
      intestatario_cc: "Laura Rossi",
    },
  },
  {
    email: "ufficio2@demo-agenzia.it",
    password: "Demo2024!",
    profile: {
      nome: "Giuseppe",
      cognome: "Verdi",
      ruolo: "ufficio",
      descrizione: "Responsabile sede Roma",
      indirizzo: "Via del Corso 120",
      cap: "00186",
      citta: "Roma",
      provincia: "RM",
      telefono: "06-5551234",
      fax: "06-5551235",
      codice_fiscale: "VRDGPP78C12H501Q",
      nome_rui: "Giuseppe Verdi",
      data_iscrizione_rui: "2008-11-05",
      numero_rui: "A000345678",
      sezione_rui: "A",
      codice_contabile: "UFF002",
      percentuale_ra: 23.00,
      iban: "IT60X0542811101000000345678",
      intestatario_cc: "Giuseppe Verdi",
    },
  },
  {
    email: "produttore1@demo-agenzia.it",
    password: "Demo2024!",
    profile: {
      nome: "Alessandro",
      cognome: "Ferrari",
      ruolo: "produttore",
      descrizione: "Produttore senior Auto/RC",
      indirizzo: "Corso Buenos Aires 45",
      cap: "20124",
      citta: "Milano",
      provincia: "MI",
      telefono: "02-3334455",
      fax: "",
      codice_fiscale: "FRRLSN82D15F205R",
      nome_rui: "Alessandro Ferrari",
      data_iscrizione_rui: "2014-02-28",
      numero_rui: "E000456789",
      sezione_rui: "E",
      codice_contabile: "PRD001",
      percentuale_ra: 23.00,
      iban: "IT60X0542811101000000456789",
      intestatario_cc: "Alessandro Ferrari",
    },
  },
  {
    email: "produttore2@demo-agenzia.it",
    password: "Demo2024!",
    profile: {
      nome: "Francesca",
      cognome: "Colombo",
      ruolo: "produttore",
      descrizione: "Produttore Vita e Previdenza",
      indirizzo: "Via Manzoni 30",
      cap: "20121",
      citta: "Milano",
      provincia: "MI",
      telefono: "02-6667788",
      fax: "02-6667789",
      codice_fiscale: "CLMFNC90H55F205B",
      nome_rui: "Francesca Colombo",
      data_iscrizione_rui: "2016-09-10",
      numero_rui: "E000567890",
      sezione_rui: "E",
      codice_contabile: "PRD002",
      percentuale_ra: 23.00,
      iban: "IT60X0542811101000000567890",
      intestatario_cc: "Francesca Colombo",
    },
  },
  {
    email: "produttore3@demo-agenzia.it",
    password: "Demo2024!",
    profile: {
      nome: "Roberto",
      cognome: "Esposito",
      ruolo: "produttore",
      descrizione: "Produttore Danni non Auto",
      indirizzo: "Via Toledo 200",
      cap: "80134",
      citta: "Napoli",
      provincia: "NA",
      telefono: "081-2223344",
      fax: "",
      codice_fiscale: "SPSRRT88L22F839W",
      nome_rui: "Roberto Esposito",
      data_iscrizione_rui: "2015-04-18",
      numero_rui: "E000678901",
      sezione_rui: "E",
      codice_contabile: "PRD003",
      percentuale_ra: 23.00,
      iban: "IT60X0542811101000000678901",
      intestatario_cc: "Roberto Esposito",
    },
  },
  {
    email: "produttore4@demo-agenzia.it",
    password: "Demo2024!",
    profile: {
      nome: "Elena",
      cognome: "Moretti",
      ruolo: "produttore",
      descrizione: "Produttore Corporate e PMI",
      indirizzo: "Via Garibaldi 55",
      cap: "10122",
      citta: "Torino",
      provincia: "TO",
      telefono: "011-4445566",
      fax: "011-4445567",
      codice_fiscale: "MRTLNE87S52L219H",
      nome_rui: "Elena Moretti",
      data_iscrizione_rui: "2013-07-22",
      numero_rui: "E000789012",
      sezione_rui: "E",
      codice_contabile: "PRD004",
      percentuale_ra: 23.00,
      iban: "IT60X0542811101000000789012",
      intestatario_cc: "Elena Moretti",
    },
  },
  {
    email: "contabilita@demo-agenzia.it",
    password: "Demo2024!",
    profile: {
      nome: "Paola",
      cognome: "Ricci",
      ruolo: "contabilita",
      descrizione: "Responsabile contabilità",
      indirizzo: "Via Dante 12",
      cap: "20121",
      citta: "Milano",
      provincia: "MI",
      telefono: "02-7778899",
      fax: "02-7778800",
      codice_fiscale: "RCCPLA79M61F205J",
      nome_rui: "",
      data_iscrizione_rui: null,
      numero_rui: "",
      sezione_rui: "",
      codice_contabile: "CNT001",
      percentuale_ra: 0,
      iban: "IT60X0542811101000000890123",
      intestatario_cc: "Paola Ricci",
    },
  },
  {
    email: "cfo@demo-agenzia.it",
    password: "Demo2024!",
    profile: {
      nome: "Stefano",
      cognome: "Marchetti",
      ruolo: "cfo",
      descrizione: "Chief Financial Officer",
      indirizzo: "Piazza Duomo 1",
      cap: "20122",
      citta: "Milano",
      provincia: "MI",
      telefono: "02-1112233",
      fax: "02-1112234",
      codice_fiscale: "MRCSFN75E18F205V",
      nome_rui: "Stefano Marchetti",
      data_iscrizione_rui: "2005-01-10",
      numero_rui: "A000890123",
      sezione_rui: "A",
      codice_contabile: "CFO001",
      percentuale_ra: 23.00,
      iban: "IT60X0542811101000000901234",
      intestatario_cc: "Stefano Marchetti",
    },
  },
  {
    email: "admin2@demo-agenzia.it",
    password: "Demo2024!",
    profile: {
      nome: "Chiara",
      cognome: "Galli",
      ruolo: "admin",
      descrizione: "Vice amministratore",
      indirizzo: "Via Torino 78",
      cap: "20123",
      citta: "Milano",
      provincia: "MI",
      telefono: "02-9990011",
      fax: "",
      codice_fiscale: "GLLCHR92R48F205N",
      nome_rui: "Chiara Galli",
      data_iscrizione_rui: "2018-05-30",
      numero_rui: "A000901234",
      sezione_rui: "A",
      codice_contabile: "AMM002",
      percentuale_ra: 23.00,
      iban: "IT60X0542811101000001012345",
      intestatario_cc: "Chiara Galli",
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const results: { email: string; status: string; error?: string }[] = [];

    for (const u of DEMO_USERS) {
      // Check if user already exists
      const { data: existingProfiles } = await adminClient
        .from("profiles")
        .select("id, email")
        .eq("email", u.email)
        .limit(1);

      if (existingProfiles && existingProfiles.length > 0) {
        // Update existing profile with new fields
        await adminClient.from("profiles").update(u.profile).eq("id", existingProfiles[0].id);
        results.push({ email: u.email, status: "updated" });
        continue;
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });

      if (createError) {
        results.push({ email: u.email, status: "error", error: createError.message });
        continue;
      }

      const userId = newUser.user.id;

      const { error: profileError } = await adminClient.from("profiles").insert({
        id: userId,
        email: u.email,
        attivo: true,
        ...u.profile,
      });

      if (profileError) {
        results.push({ email: u.email, status: "error", error: profileError.message });
        continue;
      }

      await adminClient.from("user_roles").insert({
        user_id: userId,
        role: u.profile.ruolo,
      });

      results.push({ email: u.email, status: "created" });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
