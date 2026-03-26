import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ==================== ITALIAN DATA ====================
const NM = ['Marco','Luca','Alessandro','Andrea','Giuseppe','Francesco','Paolo','Stefano','Giovanni','Roberto','Antonio','Matteo','Davide','Federico','Lorenzo','Simone','Massimo','Fabio','Alberto','Claudio','Enrico','Riccardo','Michele','Daniele','Vincenzo','Salvatore','Pietro','Sergio','Carlo','Nicola','Tommaso','Emanuele','Filippo','Giorgio','Leonardo','Gabriele','Diego','Flavio','Edoardo','Giacomo'];
const NF = ['Maria','Anna','Laura','Giulia','Francesca','Sara','Elena','Chiara','Valentina','Alessandra','Silvia','Roberta','Monica','Paola','Martina','Elisa','Federica','Claudia','Barbara','Cristina','Simona','Daniela','Ilaria','Serena','Emanuela','Michela','Veronica','Teresa','Patrizia','Luisa','Sofia','Aurora','Beatrice','Camilla','Arianna','Irene','Marta','Alice','Giorgia','Noemi'];
const COG = ['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti','De Luca','Costa','Giordano','Mancini','Rizzo','Lombardi','Moretti','Barbieri','Fontana','Santoro','Mariani','Rinaldi','Caruso','Ferrara','Galli','Martini','Leone','Longo','Gentile','Martinelli','Vitale','Pellegrini','Serra','Marchetti','Villa','Cattaneo','Fabbri','Monti','Sorrentino','Valentini','Coppola','De Angelis','Palumbo','Sanna','Ferraro','Amato','Silvestri'];
const CITIES = [
  {c:'Roma',cap:'00185',p:'RM'},{c:'Milano',cap:'20121',p:'MI'},{c:'Napoli',cap:'80134',p:'NA'},
  {c:'Torino',cap:'10121',p:'TO'},{c:'Firenze',cap:'50122',p:'FI'},{c:'Bologna',cap:'40126',p:'BO'},
  {c:'Genova',cap:'16121',p:'GE'},{c:'Palermo',cap:'90133',p:'PA'},{c:'Bari',cap:'70122',p:'BA'},
  {c:'Catania',cap:'95131',p:'CT'},{c:'Verona',cap:'37121',p:'VR'},{c:'Padova',cap:'35122',p:'PD'},
  {c:'Brescia',cap:'25121',p:'BS'},{c:'Bergamo',cap:'24121',p:'BG'},{c:'Modena',cap:'41121',p:'MO'},
  {c:'Parma',cap:'43121',p:'PR'},{c:'Perugia',cap:'06121',p:'PG'},{c:'Cagliari',cap:'09124',p:'CA'},
  {c:'Trieste',cap:'34121',p:'TS'},{c:'Reggio Emilia',cap:'42121',p:'RE'},
  {c:'Salerno',cap:'84121',p:'SA'},{c:'Messina',cap:'98122',p:'ME'},
  {c:'Livorno',cap:'57123',p:'LI'},{c:'Ancona',cap:'60121',p:'AN'},{c:'Pisa',cap:'56125',p:'PI'},
  {c:'Lecce',cap:'73100',p:'LE'},{c:'Pescara',cap:'65122',p:'PE'},{c:'Vicenza',cap:'36100',p:'VI'},
  {c:'Treviso',cap:'31100',p:'TV'},{c:'Udine',cap:'33100',p:'UD'},
];
const STRADE = ['Via Roma','Via Garibaldi','Corso Italia','Via Mazzini','Via Dante','Via Verdi','Via Leopardi','Via Cavour','Via della Repubblica','Via XX Settembre','Via Marconi','Viale Europa','Via Gramsci','Via Matteotti','Via Carducci','Via Pascoli','Via Foscolo','Corso Vittorio Emanuele','Via dei Mille','Piazza della Libertà'];
const RAGIONI = ['Tecnoservice','Edilcostruzioni','Agroalimentare del Sud','Logistica Express','Meccanica di Precisione','Farmaceutica Italiana','Chimica Industriale','IT Solutions','Energia Rinnovabile','Consulenza & Gestione','Immobiliare Moderna','Automotive Italia','Tessile & Moda','Alimentari Genuini','Costruzioni Generali','Engineering Group','Digital Innovation','Green Power','Quality Systems','Professional Services','Metal Works','Trasporti Veloci','Bio Cosmetics','Elettronica Avanzata','Servizi Finanziari'];
const FORME = ['S.r.l.','S.p.A.','S.a.s.','S.n.c.','S.r.l.s.'];
const COMUNI_NASCITA = ['A944','F205','H501','L219','D612','G273','B354','C351','E463','L736','A662','B157','C933','D969','E625'];
const SETTORI = ['Manifatturiero','Servizi','Commercio','Edilizia','Trasporti','Agricoltura','Turismo','Sanità','Istruzione','Pubblica Amministrazione','Finanza','Tecnologia','Energia','Alimentare'];
const ZONE = ['Nord','Centro','Sud','Isole'];
const CODICI_ATECO = ['01.11','10.71','25.11','41.20','43.21','46.90','47.11','49.41','55.10','56.10','62.01','64.19','68.20','69.10','70.22','71.12','73.11','82.11','85.10','86.10'];
const ENTI_NOMI = [
  {nome:'ASL Roma 1',tipo_ente:'ASL'},{nome:'ASL Napoli 1 Centro',tipo_ente:'ASL'},{nome:'ASL Città di Torino',tipo_ente:'ASL'},
  {nome:'ASL Milano',tipo_ente:'ASL'},{nome:'ASL Toscana Centro',tipo_ente:'ASL'},{nome:'ASL Bologna',tipo_ente:'ASL'},
  {nome:'Comune di Roma',tipo_ente:'Comune'},{nome:'Comune di Milano',tipo_ente:'Comune'},{nome:'Comune di Napoli',tipo_ente:'Comune'},
  {nome:'Comune di Firenze',tipo_ente:'Comune'},{nome:'Comune di Bologna',tipo_ente:'Comune'},{nome:'Comune di Torino',tipo_ente:'Comune'},
  {nome:'Provincia di Roma',tipo_ente:'Provincia'},{nome:'Provincia di Milano',tipo_ente:'Provincia'},{nome:'Provincia di Napoli',tipo_ente:'Provincia'},
  {nome:'Regione Lazio',tipo_ente:'Regione'},{nome:'Regione Lombardia',tipo_ente:'Regione'},{nome:'Regione Campania',tipo_ente:'Regione'},
  {nome:'Università La Sapienza',tipo_ente:'Università'},{nome:'Politecnico di Milano',tipo_ente:'Università'},{nome:'Università Federico II',tipo_ente:'Università'},
  {nome:'Università di Bologna',tipo_ente:'Università'},{nome:'Università di Firenze',tipo_ente:'Università'},
  {nome:'INPS - Direzione Provinciale Roma',tipo_ente:'INPS'},{nome:'INPS - Direzione Provinciale Milano',tipo_ente:'INPS'},
  {nome:'INAIL - Sede di Roma',tipo_ente:'INAIL'},{nome:'INAIL - Sede di Milano',tipo_ente:'INAIL'},
  {nome:'Azienda Ospedaliera San Camillo',tipo_ente:'Ospedale'},{nome:'Policlinico Gemelli',tipo_ente:'Ospedale'},
  {nome:'Camera di Commercio di Roma',tipo_ente:'CCIAA'},
];

// ==================== HELPERS ====================
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const ri = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const rf = (min: number, max: number) => +(Math.random() * (max - min) + min).toFixed(2);
const pad = (n: number, l: number) => String(n).padStart(l, '0');
const uuid = () => crypto.randomUUID();

const fakeCF = (cog: string, nom: string, y: number, m: number, d: number, sex: 'M'|'F'): string => {
  const cons = (s: string) => s.toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '');
  const vow = (s: string) => s.toUpperCase().replace(/[^AEIOU]/g, '');
  const part = (s: string) => (cons(s) + vow(s) + 'XXX').substring(0, 3);
  const ml = 'ABCDEHLMPRST';
  const p = part(cog) + part(nom) + pad(y % 100, 2) + ml[m - 1] + pad(sex === 'F' ? d + 40 : d, 2) + pick(COMUNI_NASCITA);
  return p + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[ri(0, 25)];
};
const fakePIVA = () => pad(ri(1000000000, 9999999999), 11);
const fakeIBAN = () => `IT${pad(ri(10,99),2)}${String.fromCharCode(65+ri(0,25))}${pad(ri(10000,99999),5)}${pad(ri(10000,99999),5)}${pad(ri(100000000000,999999999999),12)}`;
const fakePhone = () => `${pick(['338','339','340','347','348','349','366','388','391','392'])} ${ri(1000000,9999999)}`;
const fakeDate = (yf: number, yt: number) => `${ri(yf,yt)}-${pad(ri(1,12),2)}-${pad(ri(1,28),2)}`;

// Batch insert helper
async function batchInsert(db: any, table: string, data: any[], batchSize = 50, onConflict?: string) {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const opts = onConflict ? { onConflict, ignoreDuplicates: true } : {};
    const { error } = await db.from(table).upsert(batch, opts);
    if (error) throw new Error(`${table} batch ${i}: ${error.message}`);
  }
  return data.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const R: Record<string, number> = {};

    // ==================== 1. UFFICI ====================
    const ufficiCodes = ['DEMO-ROMA','DEMO-MIL','DEMO-NAP','DEMO-FIR','DEMO-BOL'];
    const ufficiNomi = ['Sede Centrale Roma','Filiale Milano','Agenzia Napoli','Filiale Firenze','Punto Vendita Bologna'];
    for (let i = 0; i < ufficiCodes.length; i++) {
      const { data: ex } = await db.from('uffici').select('id').eq('codice_ufficio', ufficiCodes[i]).limit(1);
      if (!ex || ex.length === 0) {
        await db.from('uffici').insert({ nome_ufficio: ufficiNomi[i], codice_ufficio: ufficiCodes[i], attivo: true });
      }
    }
    const { data: ufficiRows } = await db.from('uffici').select('id').eq('attivo', true);
    const uIds = (ufficiRows || []).map((u: any) => u.id);
    if (uIds.length === 0) throw new Error('Nessun ufficio trovato');
    R.uffici = uIds.length;

    // ==================== 2. PROFILES via auth.admin.createUser ====================
    const allUsers = [
      // Staff
      { n:'Marco',c:'Bianchi',r:'produttore',e:'marco.bianchi@consul-demo.it'},
      { n:'Laura',c:'Conti',r:'produttore',e:'laura.conti@consul-demo.it'},
      { n:'Giuseppe',c:'Ferrara',r:'produttore',e:'giuseppe.ferrara@consul-demo.it'},
      { n:'Francesca',c:'Moretti',r:'ufficio',e:'francesca.moretti@consul-demo.it'},
      { n:'Roberto',c:'Galli',r:'ufficio',e:'roberto.galli@consul-demo.it'},
      { n:'Enrico',c:'Martinelli',r:'produttore',e:'enrico.martinelli@consul-demo.it'},
      { n:'Paola',c:'Serra',r:'produttore',e:'paola.serra@consul-demo.it'},
      { n:'Simone',c:'Cattaneo',r:'contabilita',e:'simone.cattaneo@consul-demo.it'},
      { n:'Elena',c:'Marchetti',r:'produttore',e:'elena.marchetti@consul-demo.it'},
      { n:'Davide',c:'Fontana',r:'produttore',e:'davide.fontana@consul-demo.it'},
      { n:'Chiara',c:'Rinaldi',r:'ufficio',e:'chiara.rinaldi@consul-demo.it'},
      { n:'Fabio',c:'Monti',r:'cfo',e:'fabio.monti@consul-demo.it'},
    ];
    // 25 client users
    for (let i = 0; i < 25; i++) {
      const male = Math.random() > 0.45;
      const nome = pick(male ? NM : NF);
      const cognome = pick(COG);
      allUsers.push({ n: nome, c: cognome, r: 'cliente', e: `cliente.demo.${i}@consul-demo.it` });
    }

    const createdIds: string[] = [];
    const staffIds: string[] = [];
    const prodIds: string[] = [];
    const clientIds: string[] = [];

    for (const u of allUsers) {
      // Check if email already exists
      const { data: existing } = await db.from('profiles').select('id').eq('email', u.e).limit(1);
      if (existing && existing.length > 0) {
        const id = existing[0].id;
        createdIds.push(id);
        if (u.r !== 'cliente') { staffIds.push(id); if (u.r === 'produttore') prodIds.push(id); }
        else clientIds.push(id);
        continue;
      }
      const { data: newUser, error: authErr } = await db.auth.admin.createUser({
        email: u.e, password: 'DemoTest123!', email_confirm: true,
      });
      if (authErr) { console.error(`Auth skip ${u.e}: ${authErr.message}`); continue; }
      const id = newUser.user.id;
      createdIds.push(id);
      if (u.r !== 'cliente') { staffIds.push(id); if (u.r === 'produttore') prodIds.push(id); }
      else clientIds.push(id);

      await db.from('profiles').insert({
        id, nome: u.n, cognome: u.c, email: u.e,
        ruolo: u.r, attivo: true, ufficio_id: pick(uIds),
      });
      await db.from('user_roles').insert({ user_id: id, role: u.r });
    }

    const allStaffIds = staffIds.length > 0 ? staffIds : ['62a676ea-93d2-4a58-9dee-3189f3fba692'];
    if (prodIds.length === 0) prodIds.push('aed93cfd-12ba-4f28-9d5c-efe39935aa94');
    if (clientIds.length === 0) clientIds.push('d2364de7-7548-463e-9a67-ecbf68b9aee1');
    R.profiles = createdIds.length;

    // ==================== 3. CLIENTI (CRM - 160 privati + 50 aziende + 30 enti) ====================
    const clientiData: any[] = [];
    const clientiIds: string[] = [];

    // 160 privati
    for (let i = 0; i < 160; i++) {
      const male = Math.random() > 0.45;
      const nome = pick(male ? NM : NF);
      const cognome = pick(COG);
      const city = pick(CITIES);
      const yN = ri(1945, 2002);
      const mN = ri(1, 12);
      const dN = ri(1, 28);
      const birthCity = pick(CITIES);
      const id = uuid();
      clientiIds.push(id);
      clientiData.push({
        id,
        tipo_cliente: 'privato',
        tipo_persona: 'fisica',
        nome, cognome,
        sesso: male ? 'M' : 'F',
        codice_fiscale: fakeCF(cognome, nome, yN, mN, dN, male ? 'M' : 'F'),
        data_nascita: `${yN}-${pad(mN, 2)}-${pad(dN, 2)}`,
        luogo_nascita: birthCity.c,
        comune_nascita: birthCity.c,
        provincia_nascita: birthCity.p,
        email: `${nome.toLowerCase()}.${cognome.toLowerCase()}.${ri(1,999)}@email.it`,
        telefono: fakePhone(),
        cellulare: fakePhone(),
        indirizzo_residenza: `${pick(STRADE)} ${ri(1, 250)}`,
        citta_residenza: city.c,
        cap_residenza: city.cap,
        provincia_residenza: city.p,
        attivo: Math.random() > 0.08,
        stato_cliente: pick(['attivo','attivo','attivo','prospect','sospeso']),
        zona: pick(ZONE),
        settore: pick(SETTORI),
        codice_ateco: pick(CODICI_ATECO),
        fido_credito: Math.random() > 0.7 ? rf(1000, 50000) : null,
        note: `[DEMO] Cliente privato #${i + 1}`,
        ufficio_id: pick(uIds),
      });
    }

    // 50 aziende
    for (let i = 0; i < 50; i++) {
      const city = pick(CITIES);
      const base = pick(RAGIONI);
      const cog = pick(COG);
      const forma = pick(FORME);
      const piva = fakePIVA();
      const id = uuid();
      clientiIds.push(id);
      clientiData.push({
        id,
        tipo_cliente: 'azienda',
        tipo_persona: 'giuridica',
        ragione_sociale: `${base} ${cog} ${forma}`,
        forma_giuridica: forma,
        partita_iva: piva,
        codice_fiscale_azienda: piva,
        codice_sdi: `${String.fromCharCode(65 + ri(0, 25))}${pad(ri(100000, 999999), 6)}`,
        email: `info@${base.toLowerCase().replace(/[\s&']/g, '')}${ri(1,99)}.it`,
        pec: `pec@${base.toLowerCase().replace(/[\s&']/g, '')}${ri(1,99)}.legalmail.it`,
        telefono: fakePhone(),
        cellulare: fakePhone(),
        indirizzo_sede: `${pick(STRADE)} ${ri(1, 200)}`,
        citta_sede: city.c,
        cap_sede: city.cap,
        provincia_sede: city.p,
        referente_nome: pick(NM),
        referente_cognome: pick(COG),
        referente_email: `ref.${ri(1,999)}@demo.it`,
        referente_telefono: fakePhone(),
        attivo: Math.random() > 0.08,
        stato_cliente: pick(['attivo','attivo','attivo','prospect']),
        zona: pick(ZONE),
        settore: pick(SETTORI),
        codice_ateco: pick(CODICI_ATECO),
        num_dipendenti: ri(5, 500),
        fatturato: rf(100000, 50000000),
        fido_credito: rf(5000, 200000),
        fido_cauzioni: rf(10000, 500000),
        note: `[DEMO] Azienda #${i + 1}`,
        ufficio_id: pick(uIds),
      });
    }

    // 30 enti pubblici
    for (let i = 0; i < ENTI_NOMI.length; i++) {
      const ente = ENTI_NOMI[i];
      const city = CITIES[i % CITIES.length];
      const piva = fakePIVA();
      const id = uuid();
      clientiIds.push(id);
      clientiData.push({
        id,
        tipo_cliente: 'ente',
        tipo_persona: 'giuridica',
        ragione_sociale: ente.nome,
        partita_iva: piva,
        codice_fiscale_azienda: piva,
        codice_sdi: `${String.fromCharCode(65 + ri(0, 25))}${pad(ri(100000, 999999), 6)}`,
        email: `protocollo@${ente.nome.toLowerCase().replace(/[\s\-&']/g, '').substring(0, 15)}${ri(1,9)}.gov.it`,
        pec: `pec@${ente.nome.toLowerCase().replace(/[\s\-&']/g, '').substring(0, 15)}.legalmail.it`,
        telefono: fakePhone(),
        indirizzo_sede: `${pick(STRADE)} ${ri(1, 100)}`,
        citta_sede: city.c,
        cap_sede: city.cap,
        provincia_sede: city.p,
        referente_nome: pick(NM),
        referente_cognome: pick(COG),
        referente_email: `ref.${ente.tipo_ente.toLowerCase()}.${ri(1,99)}@gov.it`,
        referente_telefono: fakePhone(),
        attivo: true,
        stato_cliente: 'attivo',
        zona: pick(ZONE),
        settore: 'Pubblica Amministrazione',
        codice_ateco: '84.11',
        num_dipendenti: ri(50, 5000),
        fido_credito: rf(50000, 1000000),
        fido_cauzioni: rf(100000, 2000000),
        indotto: ente.tipo_ente,
        note: `[DEMO] Ente pubblico - ${ente.tipo_ente} #${i + 1}`,
        ufficio_id: pick(uIds),
      });
    }
    await batchInsert(db, 'clienti', clientiData);
    R.clienti = clientiData.length;

    // Separate clienti by type for later use
    const privatiIds = clientiIds.slice(0, 160);
    const aziendeIds = clientiIds.slice(160, 210);
    const entiIds = clientiIds.slice(210);

    // ==================== 4. FETCH COMPAGNIE & CATEGORIE ====================
    const { data: comp } = await db.from('compagnie').select('id');
    const { data: cat } = await db.from('categorie_prodotto').select('id');
    const compIds = (comp || []).map((c: any) => c.id);
    const catIds = (cat || []).map((c: any) => c.id);

    if (compIds.length === 0 || catIds.length === 0) {
      throw new Error('Compagnie o Categorie non trovate. Esegui prima seed-lookup-tables.');
    }

    // ==================== 5. PRODOTTI (30) ====================
    const prodNomi = [
      'RCA Base','RCA Bonus Protetto','RCA Famiglia','CVT Kasko Completa','CVT Furto Incendio','CVT Cristalli',
      'Infortuni Famiglia','Infortuni Conducente','Infortuni Sportivi',
      'Casa & Famiglia','Casa Multirischi Plus','Condominio Sicuro',
      'Vita Mista Rivalutabile','Vita TCM Temporanea','Vita Unit Linked',
      'Salute Plus','Salute Base','Salute Dentale',
      'RC Professionale Medici','RC Professionale Avvocati','RC Professionale Ingegneri',
      'RCT Aziende','RCT Artigiani','Multirischi Negozio','Multirischi Ufficio',
      'Tutela Legale Base','Tutela Legale Plus',
      'Cauzioni Appalti','Trasporti Merci Nazionali','Cyber Risk PMI',
    ];
    const prodotti = prodNomi.map((nome, i) => ({
      id: uuid(),
      nome_prodotto: nome,
      codice_prodotto: `DEMO-${pad(i + 1, 4)}`,
      compagnia_id: compIds[i % compIds.length],
      categoria_id: catIds[i % catIds.length],
      attivo: true,
      multititolo: i % 7 === 0,
    }));
    await batchInsert(db, 'prodotti', prodotti);
    const prodottoIds = prodotti.map(p => p.id);
    R.prodotti = prodotti.length;

    // ==================== 6. MATRICE PROVVIGIONI ====================
    const matrice = prodottoIds.map(pid => ({
      prodotto_id: pid,
      percentuale_provvigione: rf(5, 25),
      tipo_calcolo: pick(['percentuale', 'fisso']),
      attiva: true,
      ufficio_id: pick(uIds),
    }));
    await batchInsert(db, 'matrice_provvigioni', matrice);
    R.matrice_provvigioni = matrice.length;

    // ==================== 7. TITOLI (690 polizze collegate a clienti CRM) ====================
    const statiPol = ['creato','creato','creato','incassato','incassato','incassato','incassato','incassato','incassato','annullato','stornato'];
    const titoliData: any[] = [];
    const titoliIds: string[] = [];

    // Build distribution: privati get 1-5 polizze, aziende 3-15, enti 5-20
    const polizzeAssignment: { clienteAnagId: string; clienteAuthId: string }[] = [];

    // Privati: ~350 polizze
    for (const cid of privatiIds) {
      const numPol = ri(1, 5);
      for (let j = 0; j < numPol; j++) {
        polizzeAssignment.push({ clienteAnagId: cid, clienteAuthId: clientIds[polizzeAssignment.length % clientIds.length] });
        if (polizzeAssignment.length >= 350) break;
      }
      if (polizzeAssignment.length >= 350) break;
    }
    // Aziende: ~200 polizze
    const startAz = polizzeAssignment.length;
    for (const cid of aziendeIds) {
      const numPol = ri(3, 15);
      for (let j = 0; j < numPol; j++) {
        polizzeAssignment.push({ clienteAnagId: cid, clienteAuthId: clientIds[(polizzeAssignment.length) % clientIds.length] });
        if (polizzeAssignment.length - startAz >= 200) break;
      }
      if (polizzeAssignment.length - startAz >= 200) break;
    }
    // Enti: ~140 polizze
    const startEn = polizzeAssignment.length;
    for (const cid of entiIds) {
      const numPol = ri(5, 20);
      for (let j = 0; j < numPol; j++) {
        polizzeAssignment.push({ clienteAnagId: cid, clienteAuthId: clientIds[(polizzeAssignment.length) % clientIds.length] });
        if (polizzeAssignment.length - startEn >= 140) break;
      }
      if (polizzeAssignment.length - startEn >= 140) break;
    }

    for (let i = 0; i < polizzeAssignment.length; i++) {
      const id = uuid();
      titoliIds.push(id);
      const stato = pick(statiPol);
      const yE = ri(2019, 2025);
      const premioLordo = rf(80, 12000);
      let importoIncassato: number | null = null;
      let dataIncasso: string | null = null;

      if (stato === 'incassato') {
        importoIncassato = premioLordo;
        dataIncasso = fakeDate(yE, Math.min(yE + 1, 2026));
      } else if (stato === 'attivo' && Math.random() > 0.6) {
        importoIncassato = premioLordo;
        dataIncasso = fakeDate(yE, Math.min(yE + 1, 2026));
      } else if (stato === 'stornato') {
        importoIncassato = 0;
      }

      titoliData.push({
        id,
        numero_titolo: `POL-${yE}-${pad(i + 1, 6)}`,
        stato,
        premio_lordo: premioLordo,
        importo_incassato: importoIncassato,
        data_incasso: dataIncasso,
        prodotto_id: prodottoIds[i % prodottoIds.length],
        cliente_id: polizzeAssignment[i].clienteAuthId,
        cliente_anagrafica_id: polizzeAssignment[i].clienteAnagId,
        produttore_id: pick(prodIds),
        ufficio_id: pick(uIds),
        note: `[DEMO] Polizza ${stato} - ${prodNomi[i % prodNomi.length]}`,
      });
    }
    await batchInsert(db, 'titoli', titoliData);
    R.titoli = titoliData.length;

    // ==================== 7b. CLIENTI RELAZIONI (40 relazioni) ====================
    const relazioniData: any[] = [];
    const tipiRel: Array<'dipendente'|'legale_rappresentante'|'referente'|'socio'> = ['dipendente','legale_rappresentante','referente','socio'];
    // Link some privati to aziende/enti
    for (let i = 0; i < 40; i++) {
      const privato = privatiIds[i % privatiIds.length];
      const target = i < 25 ? aziendeIds[i % aziendeIds.length] : entiIds[(i - 25) % entiIds.length];
      relazioniData.push({
        cliente_id: privato,
        cliente_collegato_id: target,
        tipo_relazione: tipiRel[i % tipiRel.length],
        note: `[DEMO] Relazione ${tipiRel[i % tipiRel.length]} #${i + 1}`,
      });
    }
    await batchInsert(db, 'clienti_relazioni', relazioniData);
    R.clienti_relazioni = relazioniData.length;

    // ==================== 8. SINISTRI (25) ====================
    const statiSin = ['aperto','aperto','in_lavorazione','in_lavorazione','in_attesa_documenti','chiuso','chiuso','respinto'];
    const descSin = ['Incidente stradale con tamponamento','Danno da infiltrazione acqua','Furto con scasso in abitazione','Incendio parziale magazzino','Grandine su autoveicolo','Danni da evento atmosferico','Infortunio sul lavoro','Danni a terzi per caduta oggetti','Rottura tubatura condominiale','Furto parziale autoveicolo','Sinistro RCA con lesioni lievi','Allagamento locale commerciale','Caduta albero su autovettura','Danni da fulmine','Furto gioielli in abitazione','Crollo parziale controsoffitto','Incidente in parcheggio','Rottura vetrina negozio','Responsabilità professionale','Danno biologico da infortunio','Sinistro kasko','Furto bicicletta assicurata','Guasto impianto elettrico','Danni da vento forte','Sinistro RC auto con concorso'];
    const titoliValidi = titoliData.filter(t => t.stato === 'creato' || t.stato === 'incassato');

    const sinistri: any[] = [];
    const sinIds: string[] = [];
    for (let i = 0; i < 25; i++) {
      const id = uuid();
      sinIds.push(id);
      const tit = titoliValidi[i % titoliValidi.length];
      const stato = pick(statiSin);
      const dA = fakeDate(2022, 2025);
      sinistri.push({
        id,
        numero_sinistro: `SIN-${ri(2022,2025)}-${pad(i + 1, 5)}`,
        stato,
        data_apertura: dA,
        data_chiusura: stato === 'chiuso' ? fakeDate(2024, 2026) : null,
        descrizione: `[DEMO] ${descSin[i]}`,
        titolo_id: tit.id,
        cliente_id: tit.cliente_id,
        compagnia_id: pick(compIds),
        responsabile_id: pick(prodIds),
        ufficio_id: pick(uIds),
      });
    }
    await batchInsert(db, 'sinistri', sinistri);
    R.sinistri = sinistri.length;

    // ==================== 9. SINISTRO EVENTI & CHECKLIST ====================
    const sinEventi: any[] = [];
    const sinCheck: any[] = [];
    const tipiEvento = ['perizia','udienza','documentazione','sopralluogo','verifica','riserva','liquidazione'];
    const descCheck = ['Raccolta documentazione completa','Denuncia firmata dal cliente','Perizia tecnica completata','Foto danno allegate','Testimonianze raccolte','Modulo CID/CAI compilato','Preventivo riparazione allegato','Documentazione medica','Fattura riparazione','Verbale autorità'];

    for (const sid of sinIds) {
      for (let j = 0; j < ri(1, 4); j++) {
        sinEventi.push({
          sinistro_id: sid,
          tipo_evento: pick(tipiEvento),
          data_scadenza: fakeDate(2024, 2026),
          stato: pick(['attivo', 'completato', 'scaduto']),
          note: '[DEMO] Evento sinistro',
        });
      }
      for (let j = 0; j < ri(3, 6); j++) {
        sinCheck.push({
          sinistro_id: sid,
          descrizione: descCheck[j % descCheck.length],
          obbligatorio: Math.random() > 0.3,
          completato: Math.random() > 0.4,
        });
      }
    }
    await batchInsert(db, 'sinistro_eventi', sinEventi);
    await batchInsert(db, 'sinistro_checklist', sinCheck);
    R.sinistro_eventi = sinEventi.length;
    R.sinistro_checklist = sinCheck.length;

    // ==================== 10. MOVIMENTI CONTABILI (60) ====================
    const categorieMov = ['premi', 'provvigioni', 'spese_generali', 'rimborsi', 'altro'];
    const descEntrata = ['Incasso premio polizza','Recupero credito cliente','Rata premio trimestrale','Saldo annuale polizza','Acconto premio','Incasso rinnovo','Bonifico cliente'];
    const descUscita = ['Pagamento provvigione produttore','Storno premio','Rimborso cliente','Spese cancelleria ufficio','Affitto sede','Utenze','Spese postali'];
    const movimenti: any[] = [];

    for (let i = 0; i < 60; i++) {
      const tipo = Math.random() > 0.4 ? 'entrata' : 'uscita';
      const importo = rf(50, 15000);
      const tit = pick(titoliData);
      const ivaAliq = pick([22, 10, 4, 0]);
      movimenti.push({
        tipo,
        importo,
        data_movimento: fakeDate(2022, 2026),
        descrizione: `[DEMO] ${pick(tipo === 'entrata' ? descEntrata : descUscita)}`,
        stato: pick(['registrato', 'registrato', 'verificato', 'verificato', 'verificato']),
        categoria: pick(categorieMov),
        ufficio_id: pick(uIds),
        riferimento_id: tit.id,
        riferimento_tipo: 'titolo',
        created_by: pick(allStaffIds),
        iva_aliquota: ivaAliq > 0 ? ivaAliq : null,
        iva_imponibile: ivaAliq > 0 ? rf(50, 5000) : null,
        iva_importo: ivaAliq > 0 ? rf(5, 1000) : null,
      });
    }
    await batchInsert(db, 'movimenti_contabili', movimenti);
    R.movimenti_contabili = movimenti.length;

    // ==================== 11. PROVVIGIONI GENERATE (50) ====================
    const titoliInc = titoliData.filter(t => t.stato === 'incassato' && t.premio_lordo > 0);
    const provvigioni: any[] = [];
    for (let i = 0; i < Math.min(50, titoliInc.length); i++) {
      const t = titoliInc[i];
      const perc = rf(5, 22);
      provvigioni.push({
        titolo_id: t.id,
        user_id: t.produttore_id,
        percentuale: perc,
        importo_provvigione: +((t.premio_lordo || 0) * perc / 100).toFixed(2),
        pagata: Math.random() > 0.35,
        calcolata_il: t.data_incasso || fakeDate(2023, 2025),
      });
    }
    if (provvigioni.length > 0) await batchInsert(db, 'provvigioni_generate', provvigioni);
    R.provvigioni_generate = provvigioni.length;

    // ==================== 12. PAGAMENTI PROVVIGIONI ====================
    const provPagate = provvigioni.filter(p => p.pagata);
    const pagamentiProv: any[] = [];
    const pagamentiRighe: any[] = [];
    // Raggruppa per produttore, crea un pagamento per ogni gruppo (max 8)
    const perProduttore: Record<string, any[]> = {};
    for (const p of provPagate) {
      if (!perProduttore[p.user_id]) perProduttore[p.user_id] = [];
      perProduttore[p.user_id].push(p);
    }
    let pagCount = 0;
    for (const [userId, provs] of Object.entries(perProduttore)) {
      if (pagCount >= 8) break;
      const pagId = uuid();
      const totale = provs.reduce((s: number, p: any) => s + p.importo_provvigione, 0);
      pagamentiProv.push({
        id: pagId,
        creato_da: pick(allStaffIds),
        pagato_a_user_id: userId,
        periodo_da: '2024-01-01',
        periodo_a: '2024-12-31',
        totale_importo: +totale.toFixed(2),
        metodo: pick(['bonifico', 'bonifico', 'altro']),
        riferimento: `PAG-DEMO-${pad(pagCount + 1, 4)}`,
        note: '[DEMO] Pagamento provvigioni',
        ufficio_id: pick(uIds),
      });
      // Need provvigioni IDs - but we didn't store them. Skip righe for now.
      pagCount++;
    }
    if (pagamentiProv.length > 0) await batchInsert(db, 'pagamenti_provvigioni', pagamentiProv);
    R.pagamenti_provvigioni = pagamentiProv.length;

    // ==================== 13. RIMESSA PREMI ====================
    const rimesse: any[] = [];
    const rimesseDettaglio: any[] = [];
    for (let i = 0; i < 8; i++) {
      const rimId = uuid();
      const titoliRim = titoliInc.slice(i * 5, i * 5 + 5);
      const totale = titoliRim.reduce((s, t) => s + (t.premio_lordo || 0), 0);
      rimesse.push({
        id: rimId,
        compagnia_id: pick(compIds),
        stato: pick(['bozza', 'pronta', 'inviata']),
        totale_importi: +totale.toFixed(2),
        data_creazione: fakeDate(2024, 2025),
        created_by: pick(allStaffIds),
        ufficio_id: pick(uIds),
      });
      for (const t of titoliRim) {
        rimesseDettaglio.push({
          rimessa_id: rimId,
          titolo_id: t.id,
          importo: t.premio_lordo,
        });
      }
    }
    await batchInsert(db, 'rimessa_premi', rimesse);
    await batchInsert(db, 'rimessa_dettaglio', rimesseDettaglio);
    R.rimessa_premi = rimesse.length;
    R.rimessa_dettaglio = rimesseDettaglio.length;

    // ==================== 14. ANAGRAFICHE PROFESSIONALI (12) ====================
    const tipiAnag: Array<'liquidatore'|'perito'|'legale'|'account_executive'|'corrispondente'> = ['liquidatore','perito','legale','account_executive','corrispondente'];
    const anag: any[] = [];
    for (let i = 0; i < 12; i++) {
      const nome = pick(NM);
      const cognome = pick(COG);
      const city = pick(CITIES);
      const tipo = tipiAnag[i % tipiAnag.length];
      anag.push({
        tipo,
        nome, cognome,
        ragione_sociale: i < 4 ? `Studio ${cognome} & Associati` : null,
        codice: `DEMO-PRO-${pad(i + 1, 3)}-${ri(1000,9999)}`,
        email: `${nome.toLowerCase()}.${cognome.toLowerCase()}.${ri(1,99)}@studio-demo.it`,
        telefono: fakePhone(),
        cellulare: fakePhone(),
        indirizzo: `${pick(STRADE)} ${ri(1, 100)}`,
        citta: city.c, cap: city.cap, provincia: city.p,
        codice_fiscale: fakeCF(cognome, nome, ri(1955, 1990), ri(1, 12), ri(1, 28), 'M'),
        partita_iva: fakePIVA(),
        iban: fakeIBAN(),
        attivo: true,
        compagnia_id: pick(compIds),
        ufficio_id: pick(uIds),
        note: `[DEMO] ${tipo} demo`,
        specializzazione: pick(['Danni materiali', 'Lesioni personali', 'RCA', 'Incendio', 'Responsabilità civile', 'Vita e previdenza']),
      });
    }
    await batchInsert(db, 'anagrafiche_professionali', anag);
    R.anagrafiche_professionali = anag.length;

    // ==================== 15. PORTAFOGLIO INCASSI (20) ====================
    const portafoglio: any[] = [];
    for (let i = 0; i < 20; i++) {
      portafoglio.push({
        descrizione: `[DEMO] Rata ${pick(['mensile RCA','trimestrale Vita','annuale Casa','semestrale Infortuni','una tantum CVT'])} - #${i + 1}`,
        importo_atteso: rf(150, 6000),
        prossima_scadenza: fakeDate(2025, 2026),
        periodicita: pick(['mensile', 'trimestrale', 'annuale', 'una_tantum']),
        stato: pick(['attivo', 'attivo', 'attivo', 'sospeso', 'chiuso']),
        cliente_id: pick(clientIds),
        ufficio_id: pick(uIds),
      });
    }
    await batchInsert(db, 'portafoglio_incassi', portafoglio);
    R.portafoglio_incassi = portafoglio.length;

    // ==================== 16. PROSPECT (25) ====================
    const prospects: any[] = [];
    for (let i = 0; i < 25; i++) {
      const male = Math.random() > 0.45;
      prospects.push({
        nome: pick(male ? NM : NF),
        cognome: pick(COG),
        email: `prospect.demo.${i}@email-demo.it`,
        telefono: fakePhone(),
        stato: pick(['nuovo', 'in_trattativa', 'preventivo_inviato', 'chiuso_vinto', 'chiuso_perso']),
        fonte: pick(['web', 'referral', 'evento', 'social', 'cold_call']),
        note: '[DEMO] Prospect demo',
        assegnato_a: pick(prodIds),
        ufficio_id: pick(uIds),
      });
    }
    await batchInsert(db, 'prospect', prospects);
    R.prospect = prospects.length;

    // ==================== 17. ESTRATTI CONTO & INCROCI BANCARI ====================
    const estratti: any[] = [];
    const estrattiIds: string[] = [];
    for (let i = 0; i < 35; i++) {
      const id = uuid();
      estrattiIds.push(id);
      estratti.push({
        id,
        data_operazione: fakeDate(2023, 2026),
        importo: rf(-5000, 12000),
        descrizione: `[DEMO] ${pick(['Bonifico da cliente', 'Incasso premio RCA', 'Storno bancario', 'Accredito compagnia', 'Pagamento fornitore', 'Rata mutuo', 'Acconto sinistro'])} #${i + 1}`,
        stato: pick(['da_verificare', 'ok', 'ko']),
        ufficio_id: pick(uIds),
        saldo: rf(1000, 50000),
      });
    }
    await batchInsert(db, 'estratti_conto', estratti);
    R.estratti_conto = estratti.length;

    // Get movimenti IDs for incroci
    const { data: movIds } = await db.from('movimenti_contabili').select('id').limit(20);
    const mIds = (movIds || []).map((m: any) => m.id);

    const incroci: any[] = [];
    for (let i = 0; i < 20; i++) {
      incroci.push({
        estratto_id: estrattiIds[i % estrattiIds.length],
        movimento_id: i < mIds.length ? mIds[i] : null,
        esito: pick(['ok', 'ok', 'ok', 'ko', 'ko']),
        differenza: Math.random() > 0.7 ? rf(-50, 50) : 0,
        matching_metodo: pick(['importo_esatto', 'importo_approssimato', 'descrizione', 'manuale']),
        matching_score: rf(0.6, 1.0),
        verificato: Math.random() > 0.4,
        note: '[DEMO]',
      });
    }
    await batchInsert(db, 'incroci_bancari', incroci);
    R.incroci_bancari = incroci.length;

    // ==================== 18. PRIVACY CONSENSI & INFORMATIVE ====================
    // Informativa
    const infId = uuid();
    await db.from('privacy_informative').insert({
      id: infId,
      titolo: 'Informativa Privacy Generale',
      versione: '2.0',
      attiva: true,
      contenuto: '[DEMO] Informativa privacy generale ai sensi del GDPR...',
    });

    const consensi: any[] = [];
    for (let i = 0; i < 40; i++) {
      consensi.push({
        cliente_id: clientIds[i % clientIds.length],
        tipo_consenso: pick(['obbligatorio', 'obbligatorio', 'marketing', 'profilazione', 'comunicazioni']),
        stato: pick(['dato', 'dato', 'dato', 'dato', 'revocato']),
        data_consenso: fakeDate(2021, 2025),
        fonte: pick(['cartaceo', 'digitale', 'email', 'pec']),
        informativa_id: infId,
      });
    }
    await batchInsert(db, 'privacy_consensi', consensi);
    R.privacy_consensi = consensi.length;

    // ==================== 19. NOTIFICHE ====================
    const existingUsers = ['62a676ea-93d2-4a58-9dee-3189f3fba692', '23a9df60-1e37-4c1e-aaaf-afd9c9e53ced', 'aed93cfd-12ba-4f28-9d5c-efe39935aa94'];
    const notifiche: any[] = [];
    const titoliNot = ['Polizza in scadenza', 'Sinistro aggiornato', 'Nuovo incasso registrato', 'Documento caricato', 'Promemoria rinnovo', 'Rata scaduta', 'Anomalia rilevata', 'Provvigione calcolata'];
    for (let i = 0; i < 20; i++) {
      notifiche.push({
        destinatario_id: pick([...existingUsers, ...allStaffIds.slice(0, 5)]),
        titolo: pick(titoliNot),
        messaggio: `[DEMO] ${pick(['La polizza POL-2024-00012 è in scadenza tra 30 giorni', 'Il sinistro SIN-2024-00003 è stato aggiornato dal perito', 'Nuovo incasso di €1.520,00 registrato per il cliente Rossi', 'Documento perizia caricato per sinistro SIN-2024-00005', 'Rinnovo polizza RCA da elaborare entro 15 giorni', 'Rata trimestrale scaduta per cliente Esposito', 'Anomalia: titolo incassato senza movimento contabile', 'Provvigione €320,00 calcolata per polizza POL-2025-00045'])}`,
        tipo: pick(['scadenza', 'aggiornamento', 'incasso', 'documento', 'promemoria']),
        priorita: pick(['bassa', 'media', 'alta']),
        letto: Math.random() > 0.4,
        ufficio_id: pick(uIds),
      });
    }
    await batchInsert(db, 'notifiche', notifiche);
    R.notifiche = notifiche.length;

    // ==================== 20. IVA REGISTRI ====================
    const ivaReg: any[] = [];
    for (let y = 2024; y <= 2025; y++) {
      for (let m = 1; m <= 12; m++) {
        if (y === 2025 && m > 3) break;
        const imponibile = rf(8000, 80000);
        const iva = +(imponibile * 0.22).toFixed(2);
        ivaReg.push({
          periodo: `${y}-${pad(m, 2)}`,
          imponibile, iva,
          totale: +(imponibile + iva).toFixed(2),
          ufficio_id: pick(uIds),
          note: '[DEMO] Registro IVA mensile',
        });
      }
    }
    await batchInsert(db, 'iva_registri', ivaReg);
    R.iva_registri = ivaReg.length;

    // ==================== 21. TRATTATIVE ====================
    const { data: prospectRecs } = await db.from('prospect').select('id').order('created_at', { ascending: false }).limit(15);
    const prospIds = (prospectRecs || []).map((p: any) => p.id);
    const trattative: any[] = [];
    for (let i = 0; i < 15; i++) {
      trattative.push({
        prospect_id: prospIds[i % prospIds.length] || null,
        stato: pick(['aperta', 'in_negoziazione', 'chiusa_vinta', 'chiusa_persa']),
        compagnia: pick(['Allianz', 'Generali', 'UnipolSai', 'AXA', 'Zurich', 'Cattolica', 'Reale Mutua']),
        prodotto: pick(['RCA', 'Vita', 'Infortuni', 'Casa', 'RC Professionale', 'Salute', 'CVT Kasko']),
        premio_previsto: rf(200, 8000),
        created_by: pick(prodIds),
        data_chiusura: Math.random() > 0.4 ? fakeDate(2025, 2026) : null,
      });
    }
    await batchInsert(db, 'trattative', trattative);
    R.trattative = trattative.length;

    // ==================== 22. LOG ATTIVITÀ ====================
    const logAzioni = ['login', 'creazione_polizza', 'modifica_polizza', 'apertura_sinistro', 'incasso_premio', 'stampa_documento', 'creazione_cliente', 'modifica_cliente', 'calcolo_provvigioni', 'invio_rimessa'];
    const logData: any[] = [];
    for (let i = 0; i < 30; i++) {
      logData.push({
        user_id: pick([...existingUsers, ...allStaffIds.slice(0, 5)]),
        azione: pick(logAzioni),
        entita_tipo: pick(['titolo', 'sinistro', 'cliente', 'provvigione', 'rimessa']),
        entita_id: pick(titoliIds.slice(0, 20)),
        severity: pick(['info', 'info', 'info', 'warning', 'critical']),
        ufficio_id: pick(uIds),
        dettagli_json: { demo: true, note: `[DEMO] Log attività #${i + 1}` },
      });
    }
    await batchInsert(db, 'log_attivita', logData);
    R.log_attivita = logData.length;

    // ==================== 23. NOTE RESTITUZIONE ====================
    const noteRest: any[] = [];
    const noteRestIds: string[] = [];
    for (let i = 0; i < 8; i++) {
      const id = uuid();
      noteRestIds.push(id);
      noteRest.push({
        id,
        cliente_id: pick(clientIds),
        stato: pick(['bozza', 'pronta', 'spedita', 'chiusa']),
        note: `[DEMO] Nota di restituzione #${i + 1}`,
        created_by: pick(allStaffIds),
        ufficio_id: pick(uIds),
      });
    }
    await batchInsert(db, 'note_restituzione', noteRest);
    R.note_restituzione = noteRest.length;

    // Dettaglio note
    const noteRestDett: any[] = [];
    for (const nid of noteRestIds) {
      for (let j = 0; j < ri(1, 3); j++) {
        noteRestDett.push({
          nota_id: nid,
          titolo_id: pick(titoliIds.slice(0, 50)),
          prodotto_id: pick(prodottoIds),
        });
      }
    }
    await batchInsert(db, 'note_restituzione_dettaglio', noteRestDett);
    R.note_restituzione_dettaglio = noteRestDett.length;

    // ==================== 24. SPEDIZIONI CARTACEE ====================
    const spedizioni: any[] = [];
    for (let i = 0; i < 6; i++) {
      spedizioni.push({
        data_spedizione: fakeDate(2024, 2025),
        tipo_spedizione: pick(['singola', 'multipla']),
        stato: pick(['preparata', 'spedita', 'consegnata']),
        corriere: pick(['Poste Italiane', 'BRT', 'DHL', 'UPS', 'GLS']),
        tracking_code: `DEMO${pad(ri(100000, 999999), 6)}`,
        nota_id: pick(noteRestIds),
        created_by: pick(allStaffIds),
        ufficio_id: pick(uIds),
      });
    }
    await batchInsert(db, 'spedizioni_cartacee', spedizioni);
    R.spedizioni_cartacee = spedizioni.length;

    // ==================== 25. FLUSSI COMPAGNIA ====================
    const flussi: any[] = [];
    for (let i = 0; i < 6; i++) {
      flussi.push({
        compagnia_id: pick(compIds),
        tipo_flusso: pick(['foglio_cassa', 'reportistica']),
        formato: pick(['xml', 'api']),
        periodo: `${ri(2024, 2025)}-${pad(ri(1, 12), 2)}`,
        stato: pick(['bozza', 'pronto', 'inviato']),
        created_by: pick(allStaffIds),
        ufficio_id: pick(uIds),
      });
    }
    await batchInsert(db, 'flussi_compagnia', flussi);
    R.flussi_compagnia = flussi.length;

    // ==================== SUMMARY ====================
    return new Response(JSON.stringify({
      success: true,
      message: 'Dataset demo completo creato con successo!',
      riepilogo: R,
      totale_record: Object.values(R).reduce((a, b) => a + b, 0),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
