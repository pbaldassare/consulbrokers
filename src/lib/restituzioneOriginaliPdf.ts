import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  buildDistintaRestituzioneModel,
  type DistintaDestinatario,
  type DistintaMittente,
  type DistintaRestituzioneModel,
  type RestituzioneGruppoCompagnia,
} from "@/lib/restituzioneOriginali";

const A4 = { w: 595.28, h: 841.89 };
const M = { top: 40, right: 40, bottom: 52, left: 40 };
const CONTENT_W = A4.w - M.left - M.right;

const C = {
  text: rgb(0.12, 0.14, 0.16),
  muted: rgb(0.38, 0.4, 0.42),
  line: rgb(0.72, 0.76, 0.75),
  header: rgb(0.05, 0.28, 0.26),
  headerBar: rgb(0.05, 0.35, 0.32),
  box: rgb(0.94, 0.97, 0.96),
  boxBorder: rgb(0.78, 0.86, 0.84),
  rowAlt: rgb(0.96, 0.98, 0.97),
  white: rgb(1, 1, 1),
};

function pdfSafe(text: string): string {
  return (text || "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\u0000-\u00ff\n]/g, "");
}

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

function wrapWidth(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const raw = pdfSafe(text || "");
  if (!raw) return [""];
  const out: string[] = [];
  for (const para of raw.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(cand, size) <= maxW || !line) line = cand;
      else {
        out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([A4.w, A4.h]);
  ctx.y = A4.h - M.top;
}

function ensure(ctx: Ctx, h: number) {
  if (ctx.y - h < M.bottom + 18) newPage(ctx);
}

function text(ctx: Ctx, value: string, opts: { x?: number; size?: number; bold?: boolean; italic?: boolean; color?: ReturnType<typeof rgb>; maxW?: number }) {
  const size = opts.size ?? 9;
  const f = opts.bold ? ctx.bold : opts.italic ? ctx.italic : ctx.font;
  const x = opts.x ?? M.left;
  const maxW = opts.maxW ?? CONTENT_W;
  const col = opts.color ?? C.text;
  for (const ln of wrapWidth(value, f, size, maxW)) {
    ensure(ctx, size + 4);
    ctx.page.drawText(ln, { x, y: ctx.y - size, size, font: f, color: col });
    ctx.y -= size + 3;
  }
}

function drawHeader(ctx: Ctx, model: DistintaRestituzioneModel) {
  ctx.page.drawRectangle({
    x: 0,
    y: A4.h - 8,
    width: A4.w,
    height: 8,
    color: C.headerBar,
  });
  ctx.page.drawText("CBnet", {
    x: M.left,
    y: ctx.y - 16,
    size: 16,
    font: ctx.bold,
    color: C.header,
  });
  ctx.page.drawText(pdfSafe(model.mittente.ragioneSociale), {
    x: M.left + 56,
    y: ctx.y - 15,
    size: 9,
    font: ctx.font,
    color: C.muted,
  });
  const proto = pdfSafe(model.protocollo);
  const protoW = ctx.bold.widthOfTextAtSize(proto, 9);
  ctx.page.drawText(proto, {
    x: A4.w - M.right - protoW,
    y: ctx.y - 12,
    size: 9,
    font: ctx.bold,
    color: C.header,
  });
  const dataW = ctx.font.widthOfTextAtSize(pdfSafe(model.dataLabel), 8);
  ctx.page.drawText(pdfSafe(model.dataLabel), {
    x: A4.w - M.right - dataW,
    y: ctx.y - 24,
    size: 8,
    font: ctx.font,
    color: C.muted,
  });
  ctx.y -= 36;
  if (model.mittente.sedeNome || model.mittente.indirizzo || model.mittente.capCitta) {
    const sedeBits = [
      model.mittente.sedeNome,
      model.mittente.indirizzo,
      model.mittente.capCitta,
      model.mittente.telefono ? `Tel. ${model.mittente.telefono}` : "",
      model.mittente.email,
    ].filter(Boolean);
    text(ctx, sedeBits.join("  ·  "), { size: 8, color: C.muted });
  }
  ctx.page.drawLine({
    start: { x: M.left, y: ctx.y },
    end: { x: A4.w - M.right, y: ctx.y },
    thickness: 1,
    color: C.headerBar,
  });
  ctx.y -= 18;
  text(ctx, model.titolo, { size: 15, bold: true, color: C.header });
  ctx.y -= 4;
}

function drawDestinatario(ctx: Ctx, model: DistintaRestituzioneModel) {
  ensure(ctx, 72);
  const boxH = 62;
  const yTop = ctx.y;
  ctx.page.drawRectangle({
    x: M.left,
    y: yTop - boxH,
    width: CONTENT_W,
    height: boxH,
    color: C.box,
    borderColor: C.boxBorder,
    borderWidth: 0.8,
  });
  ctx.page.drawText("Spett.le", {
    x: M.left + 10,
    y: yTop - 14,
    size: 8,
    font: ctx.italic,
    color: C.muted,
  });
  ctx.page.drawText(pdfSafe(model.destinatario.nome), {
    x: M.left + 10,
    y: yTop - 28,
    size: 11,
    font: ctx.bold,
    color: C.text,
  });
  let ly = yTop - 42;
  if (model.destinatario.indirizzo) {
    ctx.page.drawText(pdfSafe(model.destinatario.indirizzo), {
      x: M.left + 10,
      y: ly,
      size: 8.5,
      font: ctx.font,
      color: C.text,
    });
    ly -= 12;
  }
  if (model.destinatario.capCitta) {
    ctx.page.drawText(pdfSafe(model.destinatario.capCitta), {
      x: M.left + 10,
      y: ly,
      size: 8.5,
      font: ctx.font,
      color: C.text,
    });
  }
  ctx.y = yTop - boxH - 12;
}

function drawMeta(ctx: Ctx, model: DistintaRestituzioneModel) {
  text(ctx, `Oggetto: ${model.oggetto}`, { size: 10, bold: true });
  if (model.clientiLabel) {
    text(ctx, `Clienti: ${model.clientiLabel}`, { size: 9, color: C.muted });
  }
  ctx.y -= 4;
  text(ctx, model.intro, { size: 9 });
  ctx.y -= 8;
}

const COLS = [
  { key: "n" as const, label: "N.", w: 22 },
  { key: "cliente" as const, label: "Cliente", w: 128 },
  { key: "numeroTitolo" as const, label: "N. titolo", w: 88 },
  { key: "tipo" as const, label: "Tipo", w: 62 },
  { key: "documento" as const, label: "Documento", w: 154 },
  { key: "data" as const, label: "Data", w: 49 },
];

function drawTable(ctx: Ctx, model: DistintaRestituzioneModel) {
  const headerH = 18;
  ensure(ctx, headerH + 20);
  ctx.page.drawRectangle({
    x: M.left,
    y: ctx.y - headerH,
    width: CONTENT_W,
    height: headerH,
    color: C.headerBar,
  });
  let x = M.left + 4;
  for (const col of COLS) {
    ctx.page.drawText(col.label, {
      x,
      y: ctx.y - 12,
      size: 7.5,
      font: ctx.bold,
      color: C.white,
    });
    x += col.w;
  }
  ctx.y -= headerH;

  if (model.rows.length === 0) {
    ensure(ctx, 28);
    ctx.page.drawRectangle({
      x: M.left,
      y: ctx.y - 24,
      width: CONTENT_W,
      height: 24,
      color: C.rowAlt,
      borderColor: C.line,
      borderWidth: 0.4,
    });
    ctx.page.drawText("Nessun documento originale in elenco — vedere le note.", {
      x: M.left + 8,
      y: ctx.y - 15,
      size: 8,
      font: ctx.italic,
      color: C.muted,
    });
    ctx.y -= 28;
    return;
  }

  model.rows.forEach((row, idx) => {
    const cells = COLS.map((col) =>
      wrapWidth(String(row[col.key]), ctx.font, 8, col.w - 8),
    );
    const lines = Math.max(...cells.map((c) => c.length), 1);
    const h = lines * 10 + 8;
    ensure(ctx, h + 2);
    if (idx % 2 === 1) {
      ctx.page.drawRectangle({
        x: M.left,
        y: ctx.y - h,
        width: CONTENT_W,
        height: h,
        color: C.rowAlt,
      });
    }
    ctx.page.drawLine({
      start: { x: M.left, y: ctx.y },
      end: { x: A4.w - M.right, y: ctx.y },
      thickness: 0.3,
      color: C.line,
    });
    let xi = M.left + 4;
    COLS.forEach((col, ci) => {
      cells[ci].forEach((ln, li) => {
        ctx.page.drawText(ln, {
          x: xi,
          y: ctx.y - 12 - li * 10,
          size: 8,
          font: ctx.font,
          color: C.text,
        });
      });
      xi += col.w;
    });
    ctx.y -= h;
  });
  ctx.page.drawLine({
    start: { x: M.left, y: ctx.y },
    end: { x: A4.w - M.right, y: ctx.y },
    thickness: 0.6,
    color: C.headerBar,
  });
  ctx.y -= 14;
}

function drawNote(ctx: Ctx, model: DistintaRestituzioneModel) {
  if (!model.note) return;
  const lines = wrapWidth(model.note, ctx.font, 9, CONTENT_W - 20);
  const h = 22 + lines.length * 12 + 10;
  ensure(ctx, h);
  ctx.page.drawRectangle({
    x: M.left,
    y: ctx.y - h,
    width: CONTENT_W,
    height: h,
    color: C.box,
    borderColor: C.boxBorder,
    borderWidth: 0.8,
  });
  ctx.page.drawText("Note", {
    x: M.left + 10,
    y: ctx.y - 14,
    size: 9,
    font: ctx.bold,
    color: C.header,
  });
  let ly = ctx.y - 28;
  for (const ln of lines) {
    ctx.page.drawText(pdfSafe(ln), {
      x: M.left + 10,
      y: ly,
      size: 9,
      font: ctx.font,
      color: C.text,
    });
    ly -= 12;
  }
  ctx.y -= h + 12;
}

function drawFirma(ctx: Ctx, model: DistintaRestituzioneModel) {
  ensure(ctx, 78);
  text(ctx, model.chiusura, { size: 9 });
  ctx.y -= 8;
  const colW = (CONTENT_W - 24) / 2;
  ctx.page.drawText("Per Consulbrokers", {
    x: M.left,
    y: ctx.y,
    size: 8,
    font: ctx.bold,
    color: C.muted,
  });
  ctx.page.drawText("Per l'agenzia", {
    x: M.left + colW + 24,
    y: ctx.y,
    size: 8,
    font: ctx.bold,
    color: C.muted,
  });
  ctx.y -= 28;
  ctx.page.drawLine({
    start: { x: M.left, y: ctx.y },
    end: { x: M.left + colW, y: ctx.y },
    thickness: 0.6,
    color: C.line,
  });
  ctx.page.drawLine({
    start: { x: M.left + colW + 24, y: ctx.y },
    end: { x: A4.w - M.right, y: ctx.y },
    thickness: 0.6,
    color: C.line,
  });
  ctx.y -= 12;
  if (model.generatoDa) {
    text(ctx, `Compilata da ${model.generatoDa}`, { size: 8, italic: true, color: C.muted });
  }
}

function drawFooters(ctx: Ctx) {
  const pages = ctx.doc.getPages();
  const total = pages.length;
  pages.forEach((page, i) => {
    page.drawLine({
      start: { x: M.left, y: 36 },
      end: { x: A4.w - M.right, y: 36 },
      thickness: 0.5,
      color: C.line,
    });
    const left = "CONSULBROKERS S.p.A.  |  Distinta restituzione originali";
    page.drawText(left, { x: M.left, y: 24, size: 7, font: ctx.font, color: C.muted });
    const right = `Pagina ${i + 1} di ${total}`;
    const rw = ctx.font.widthOfTextAtSize(right, 7);
    page.drawText(right, { x: A4.w - M.right - rw, y: 24, size: 7, font: ctx.font, color: C.muted });
  });
}

export async function buildDistintaRestituzionePdfFromModel(
  model: DistintaRestituzioneModel,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const page = doc.addPage([A4.w, A4.h]);
  const ctx: Ctx = { doc, page, y: A4.h - M.top, font, bold, italic };

  drawHeader(ctx, model);
  drawDestinatario(ctx, model);
  drawMeta(ctx, model);
  drawTable(ctx, model);
  drawNote(ctx, model);
  drawFirma(ctx, model);
  drawFooters(ctx);

  return doc.save();
}

export async function buildDistintaRestituzionePdf(
  gruppo: RestituzioneGruppoCompagnia,
  generatedAt: Date,
  options?: {
    note?: string;
    clientiLabel?: string;
    generatoDa?: string;
    mittente?: DistintaMittente;
    destinatario?: DistintaDestinatario;
  },
): Promise<Uint8Array> {
  const model = buildDistintaRestituzioneModel(gruppo, generatedAt, {
    ...options,
    dataLabel: format(generatedAt, "d MMMM yyyy", { locale: it }),
  });
  return buildDistintaRestituzionePdfFromModel(model);
}
