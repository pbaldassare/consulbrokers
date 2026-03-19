
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Italian first/last names for realistic data
const cognomi = [
  "Rossi","Russo","Ferrari","Esposito","Bianchi","Romano","Colombo","Ricci","Marino","Greco",
  "Bruno","Gallo","Conti","De Luca","Mancini","Costa","Giordano","Rizzo","Lombardi","Moretti",
  "Barbieri","Fontana","Santoro","Mariani","Rinaldi","Caruso","Ferrara","Gatti","Pellegrini","Palumbo",
  "Sanna","Farina","Vitale","Gentile","Longo","Martini","Leone","Sala","Conte","Ferraro",
  "Mazza","Marchetti","Villa","Parisi","Grasso","Valentini","Monti","Cattaneo","Moroni","Amato",
  "Silvestri","Testa","Fabbri","Rizzi","Benedetti","Donati","Grassi","Barone","Serra","Basile",
  "Messina","Giuliani","Bernardi","Martinelli","Coppola","Sorrentino","D'Angelo","Bianco","Pagano","Guerra",
  "De Santis","Marchetti","Orlando","Ferretti","Sartori","Riva","Piras","Battaglia","D'Amico","Pellegrino",
  "Montanari","Rossetti","Costantini","Caputo","Fiore","Galli","Bellini","De Rosa","Carbone","Neri",
  "Palmieri","Piazza","Marini","Damiani","Pozzi","Fumagalli","Landi","Mancuso","Ferri","Ruggiero",
  "Colucci","Lombardo","Valenti","Castelli","Alberti","De Angelis","Molinari","Poli","Genovese","Tosi",
  "Romagnoli","Martino","Zanetti","Pugliese","Luciano","Massaro","Ferrero","Bonetti","Oliva","Volpe",
  "Capone","Franchi","De Marco","Motta","Catalano","Moro","Rota","Giusti","Ferrante","Nardi",
  "Soriano","Pizzo","Perrone","Mele","Sabatini","Carta","Morandi","Rossini","Vitali","Pavan",
  "Forte","Ceccarelli","D'Agostino","Ruggeri","Mazzoni","Baldini","Bianchini","Innocenti","Maffei","Liguori"
];

const nomi = [
  "Marco","Giuseppe","Giovanni","Antonio","Francesco","Luca","Andrea","Alessandro","Roberto","Stefano",
  "Paolo","Davide","Matteo","Massimo","Daniele","Simone","Fabio","Alberto","Claudio","Enrico",
  "Maria","Anna","Laura","Francesca","Sara","Valentina","Chiara","Giulia","Silvia","Paola",
  "Elena","Monica","Federica","Alessandra","Cristina","Barbara","Daniela","Elisa","Serena","Patrizia",
  "Lorenzo","Nicola","Vincenzo","Riccardo","Michele","Emanuele","Federico","Giorgio","Salvatore","Carlo",
  "Martina","Roberta","Ilaria","Michela","Manuela","Raffaella","Antonella","Claudia","Luisa","Teresa"
];

const citta = [
  {nome:"Milano",prov:"MI",cap:"20100"},{nome:"Roma",prov:"RM",cap:"00100"},{nome:"Napoli",prov:"NA",cap:"80100"},
  {nome:"Torino",prov:"TO",cap:"10100"},{nome:"Bologna",prov:"BO",cap:"40100"},{nome:"Firenze",prov:"FI",cap:"50100"},
  {nome:"Genova",prov:"GE",cap:"16100"},{nome:"Palermo",prov:"PA",cap:"90100"},{nome:"Bari",prov:"BA",cap:"70100"},
  {nome:"Catania",prov:"CT",cap:"95100"},{nome:"Verona",prov:"VR",cap:"37100"},{nome:"Padova",prov:"PD",cap:"35100"},
  {nome:"Brescia",prov:"BS",cap:"25100"},{nome:"Bergamo",prov:"BG",cap:"24100"},{nome:"Modena",prov:"MO",cap:"41100"},
  {nome:"Parma",prov:"PR",cap:"43100"},{nome:"Reggio Emilia",prov:"RE",cap:"42100"},{nome:"Perugia",prov:"PG",cap:"06100"},
  {nome:"Trieste",prov:"TS",cap:"34100"},{nome:"Venezia",prov:"VE",cap:"30100"},{nome:"Vicenza",prov:"VI",cap:"36100"},
  {nome:"Ancona",prov:"AN",cap:"60100"},{nome:"Cagliari",prov:"CA",cap:"09100"},{nome:"Messina",prov:"ME",cap:"98100"},
  {nome:"Udine",prov:"UD",cap:"33100"},{nome:"Salerno",prov:"SA",cap:"84100"},{nome:"Pescara",prov:"PE",cap:"65100"},
  {nome:"Lecce",prov:"LE",cap:"73100"},{nome:"Trento",prov:"TN",cap:"38100"},{nome:"Bolzano",prov:"BZ",cap:"39100"},
  {nome:"Pisa",prov:"PI",cap:"56100"},{nome:"Livorno",prov:"LI",cap:"57100"},{nome:"Ravenna",prov:"RA",cap:"48100"},
  {nome:"Rimini",prov:"RN",cap:"47900"},{nome:"Sassari",prov:"SS",cap:"07100"},{nome:"Como",prov:"CO",cap:"22100"},
  {nome:"Varese",prov:"VA",cap:"21100"},{nome:"Monza",prov:"MB",cap:"20900"},{nome:"Novara",prov:"NO",cap:"28100"},
  {nome:"Piacenza",prov:"PC",cap:"29100"}
];

const vie = [
  "Via Roma","Via Garibaldi","Corso Italia","Via Mazzini","Via Dante","Via Verdi","Piazza della Repubblica",
  "Via Cavour","Via Marconi","Via Milano","Viale Europa","Via Leopardi","Via Carducci","Via Pascoli",
  "Via Colombo","Via Vittorio Emanuele","Via XX Settembre","Via IV Novembre","Corso Buenos Aires","Via Torino"
];

const sezioniRUI = ["A","B","C","D","E"];
const banche = ["INTESA SANPAOLO","UNICREDIT","BNL BNP PARIBAS","BANCA MONTE DEI PASCHI","BANCO BPM","BPER BANCA","CRÉDIT AGRICOLE","MEDIOBANCA"];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(n: number): string { return String(Math.floor(Math.random() * n)).padStart(String(n).length, '0'); }
function genCodFisc(): string { return (pick(cognomi).substring(0,3) + pick(nomi).substring(0,3) + pickN(99) + "A" + pickN(99) + "Z" + pickN(999) + "A").toUpperCase().substring(0,16); }
function genIBAN(): string { return "IT" + pickN(99) + String.fromCharCode(65+Math.floor(Math.random()*26)) + pickN(9999999999) + pickN(9999999999) + pickN(99999); }
function genTel(): string { return "0" + pickN(9) + " " + pickN(9999999); }
function genCell(): string { return "3" + pickN(99) + " " + pickN(9999999); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const records: any[] = [];

    // 1. Account Executive (~186 records)
    for (let i = 1; i <= 186; i++) {
      const cod = String(i).padStart(4, '0');
      const cogn = pick(cognomi);
      const nom = pick(nomi);
      const c = pick(citta);
      const annullato = Math.random() < 0.08; // ~8% annullati
      const sigla = (cogn.substring(0,2) + nom.substring(0,1)).toUpperCase();
      records.push({
        codice: cod,
        tipo: "account_executive",
        ragione_sociale: `${cogn} ${nom}`,
        cognome: cogn,
        nome: nom,
        sigla: sigla,
        indirizzo: `${pick(vie)}, ${Math.floor(Math.random()*200)+1}`,
        citta: c.nome,
        provincia: c.prov,
        cap: c.cap,
        telefono: genTel(),
        cellulare: genCell(),
        email: `${nom.toLowerCase()}.${cogn.toLowerCase()}@assicurazioni.it`,
        codice_fiscale: genCodFisc(),
        partita_iva: pickN(99999999999),
        nome_rui: `${cogn} ${nom}`,
        numero_rui: `A${pickN(999999999)}`,
        sezione_rui: pick(sezioniRUI),
        iscrizione_rui: `${2010 + Math.floor(Math.random()*14)}-${String(Math.floor(Math.random()*12)+1).padStart(2,'0')}-${String(Math.floor(Math.random()*28)+1).padStart(2,'0')}`,
        banca_riga1: pick(banche),
        banca_riga2: `AG. ${c.nome.toUpperCase()}`,
        banca_riga3: `IBAN: ${genIBAN()}`,
        iban: genIBAN(),
        abi: String(Math.floor(Math.random()*90000)+10000),
        cab: String(Math.floor(Math.random()*90000)+10000),
        annullato: annullato,
        attivo: !annullato,
        percentuale_base: 0,
        percentuale_ra: 0,
      });
    }

    // 2. Corrispondenti (~267 records)
    for (let i = 1; i <= 267; i++) {
      const cod = String(i).padStart(4, '0');
      const cogn = pick(cognomi);
      const nom = pick(nomi);
      const c = pick(citta);
      const annullato = Math.random() < 0.10;
      const percBase = Math.floor(Math.random()*30) + 5;
      const percRA = Math.floor(Math.random()*10);
      records.push({
        codice: cod,
        tipo: "corrispondente",
        ragione_sociale: `${cogn} ${nom} Assicurazioni`,
        cognome: cogn,
        nome: nom,
        indirizzo: `${pick(vie)}, ${Math.floor(Math.random()*200)+1}`,
        citta: c.nome,
        provincia: c.prov,
        cap: c.cap,
        telefono: genTel(),
        fax: genTel(),
        cellulare: genCell(),
        email: `info@${cogn.toLowerCase().replace(/[^a-z]/g,'')}assicurazioni.it`,
        pec: `${cogn.toLowerCase().replace(/[^a-z]/g,'')}@pec.it`,
        codice_fiscale: genCodFisc(),
        partita_iva: pickN(99999999999),
        numero_rui: `B${pickN(999999999)}`,
        abi: String(Math.floor(Math.random()*90000)+10000),
        cab: String(Math.floor(Math.random()*90000)+10000),
        iban: genIBAN(),
        intestatario_cc: `${cogn} ${nom}`,
        codice_fornitore: `F${String(i).padStart(5,'0')}`,
        percentuale_base: percBase,
        percentuale_ra: percRA,
        annullato: annullato,
        attivo: !annullato,
      });
    }

    // 3. Liquidatori (~12 records)
    const compagnieNomi = ["Generali","Allianz","UnipolSai","AXA","Zurich","Cattolica","Reale Mutua","Vittoria","Groupama","Sara","HDI","Helvetia"];
    for (let i = 0; i < 12; i++) {
      const cogn = pick(cognomi);
      const nom = pick(nomi);
      const c = pick(citta);
      // Try to link to existing compagnia
      const compNome = compagnieNomi[i];
      records.push({
        codice: `LIQ${String(i+1).padStart(3,'0')}`,
        tipo: "liquidatore",
        ragione_sociale: `Centro Liquidazione ${compNome} - ${c.nome}`,
        cognome: cogn,
        nome: nom,
        nome_breve: `Liq. ${compNome} ${c.nome}`,
        indirizzo: `${pick(vie)}, ${Math.floor(Math.random()*200)+1}`,
        citta: c.nome,
        provincia: c.prov,
        cap: c.cap,
        telefono: genTel(),
        cellulare: genCell(),
        email: `liquidazioni.${c.nome.toLowerCase().replace(/[^a-z]/g,'')}@${compNome.toLowerCase().replace(/[^a-z]/g,'')}.it`,
        referente_nome: `${pick(nomi)} ${pick(cognomi)}`,
        referente_email: `referente@${compNome.toLowerCase().replace(/[^a-z]/g,'')}.it`,
        annullato: false,
        attivo: true,
      });
    }

    // 4. Periti (~8 records)
    const specializzazioniPeriti = ["Auto","Incendio","Furto","RCA","Grandine","Infortuni","Vita","Trasporti"];
    for (let i = 0; i < 8; i++) {
      const cogn = pick(cognomi);
      const nom = pick(nomi);
      const c = pick(citta);
      records.push({
        codice: `PER${String(i+1).padStart(3,'0')}`,
        tipo: "perito",
        cognome: cogn,
        nome: nom,
        ragione_sociale: `${cogn} ${nom}`,
        studio_ufficio: `Studio Peritale ${cogn}`,
        specializzazione: specializzazioniPeriti[i],
        indirizzo: `${pick(vie)}, ${Math.floor(Math.random()*200)+1}`,
        citta: c.nome,
        provincia: c.prov,
        cap: c.cap,
        telefono: genTel(),
        fax: genTel(),
        cellulare: genCell(),
        email: `perito.${cogn.toLowerCase().replace(/[^a-z]/g,'')}@gmail.com`,
        pec: `${cogn.toLowerCase().replace(/[^a-z]/g,'')}.perito@pec.it`,
        albo_numero: `${pickN(99999)}`,
        annullato: false,
        attivo: true,
      });
    }

    // 5. Legali (~5 records)
    const specializzazioniLegali = ["Diritto Assicurativo","Infortunistica Stradale","Responsabilità Civile","Diritto Commerciale","Contenzioso"];
    for (let i = 0; i < 5; i++) {
      const cogn = pick(cognomi);
      const nom = pick(nomi);
      const c = pick(citta);
      records.push({
        codice: `LEG${String(i+1).padStart(3,'0')}`,
        tipo: "legale",
        cognome: cogn,
        nome: nom,
        ragione_sociale: `Avv. ${cogn} ${nom}`,
        studio_ufficio: `Studio Legale ${cogn} & Associati`,
        specializzazione: specializzazioniLegali[i],
        indirizzo: `${pick(vie)}, ${Math.floor(Math.random()*200)+1}`,
        citta: c.nome,
        provincia: c.prov,
        cap: c.cap,
        telefono: genTel(),
        fax: genTel(),
        cellulare: genCell(),
        email: `avv.${cogn.toLowerCase().replace(/[^a-z]/g,'')}@studiolegaleonline.it`,
        pec: `avv.${cogn.toLowerCase().replace(/[^a-z]/g,'')}@ordineavvocatipec.it`,
        albo_numero: `${pickN(99999)}`,
        annullato: false,
        attivo: true,
      });
    }

    // Insert in batches of 50
    let inserted = 0;
    const batchSize = 50;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error, data } = await supabase
        .from("anagrafiche_professionali")
        .upsert(batch, { onConflict: "codice,tipo", ignoreDuplicates: true });
      
      if (error) {
        errors.push(`Batch ${Math.floor(i/batchSize)+1}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }

    // Link liquidatori to compagnie where possible
    for (let i = 0; i < 12; i++) {
      const compNome = compagnieNomi[i];
      const { data: comp } = await supabase
        .from("compagnie")
        .select("id")
        .ilike("nome", `%${compNome}%`)
        .limit(1)
        .maybeSingle();

      if (comp) {
        await supabase
          .from("anagrafiche_professionali")
          .update({ compagnia_id: comp.id })
          .eq("codice", `LIQ${String(i+1).padStart(3,'0')}`)
          .eq("tipo", "liquidatore");
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_records: records.length,
      inserted,
      errors: errors.length > 0 ? errors : undefined,
      breakdown: {
        account_executive: 186,
        corrispondente: 267,
        liquidatore: 12,
        perito: 8,
        legale: 5,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
