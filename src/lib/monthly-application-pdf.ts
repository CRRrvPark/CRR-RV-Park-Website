/**
 * Letter-size PDF for a monthly extended-stay application.
 *
 * Drawn with pdf-lib (no Chromium). Looks like a park form: letterhead,
 * labeled fields, consent checks, office-use strip. Empty optional
 * sections collapse instead of printing blank rows.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  formatIsoDate,
  formatPhone,
  formatSubmittedAt,
  fullName,
  type MonthlyApplication,
  type HousingRecord,
  type PetRecord,
} from './monthly-application';

const PAGE_W = 612;
const PAGE_H = 792;
const MX = 44;
const FOOTER_Y = 36;
const CONTENT_BOTTOM = 52;
const CONTENT_W = PAGE_W - MX * 2;

const C = {
  deep: rgb(20 / 255, 12 / 255, 4 / 255),
  gold: rgb(212 / 255, 168 / 255, 83 / 255),
  rust: rgb(196 / 255, 98 / 255, 45 / 255),
  cream: rgb(245 / 255, 239 / 255, 230 / 255),
  sand: rgb(237 / 255, 229 / 255, 216 / 255),
  text: rgb(44 / 255, 24 / 255, 16 / 255),
  muted: rgb(102 / 255, 80 / 255, 64 / 255),
  line: rgb(210 / 255, 198 / 255, 180 / 255),
  white: rgb(1, 1, 1),
};

function toWinAnsi(s: string): string {
  return Array.from(s).map(ch => {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 9 || c === 10 || c === 13) return ch;
    if (c >= 32 && c <= 126) return ch;
    if (c === 0x2018 || c === 0x2019 || c === 0x02BC) return "'";
    if (c === 0x201C || c === 0x201D) return '"';
    if (c === 0x2013 || c === 0x2014) return '-';
    if (c === 0x2026) return '...';
    if (c === 0x00A0 || c === 0x202F) return ' ';
    if (c <= 255) return ch;
    return '?';
  }).join('');
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const clean = toWinAnsi(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return ['—'];
  const words = clean.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const trial = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      cur = trial;
      continue;
    }
    if (cur) lines.push(cur);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      cur = word;
    } else {
      let chunk = '';
      for (const ch of word) {
        const t = chunk + ch;
        if (font.widthOfTextAtSize(t, size) <= maxWidth) chunk = t;
        else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      cur = chunk;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : ['—'];
}

class FormPainter {
  doc: PDFDocument;
  page!: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y = 0;
  pages: PDFPage[] = [];

  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.newPage(true);
  }

  newPage(first = false) {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.page);
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: C.cream });
    if (first) {
      this.page.drawRectangle({ x: 0, y: PAGE_H - 78, width: PAGE_W, height: 78, color: C.deep });
      this.page.drawRectangle({ x: 0, y: PAGE_H - 82, width: PAGE_W, height: 4, color: C.gold });
      this.page.drawText('CROOKED RIVER RANCH RV PARK', {
        x: MX, y: PAGE_H - 32, size: 9, font: this.bold, color: C.gold,
      });
      this.page.drawText('Winter Monthly Stay Application', {
        x: MX, y: PAGE_H - 52, size: 18, font: this.bold, color: C.white,
      });
      this.page.drawText('14875 SW Hays Lane  ·  Terrebonne, OR 97760  ·  541-923-1441', {
        x: MX, y: PAGE_H - 68, size: 8, font: this.font, color: rgb(0.85, 0.78, 0.7),
      });
      this.y = PAGE_H - 100;
    } else {
      this.page.drawRectangle({ x: 0, y: PAGE_H - 28, width: PAGE_W, height: 28, color: C.deep });
      this.page.drawText('Crooked River Ranch RV Park  ·  Winter Monthly Stay Application', {
        x: MX, y: PAGE_H - 18, size: 8, font: this.bold, color: C.gold,
      });
      this.y = PAGE_H - 48;
    }
  }

  finishFooters() {
    const n = this.pages.length;
    this.pages.forEach((page, i) => {
      page.drawLine({
        start: { x: MX, y: FOOTER_Y + 12 },
        end: { x: PAGE_W - MX, y: FOOTER_Y + 12 },
        thickness: 0.5,
        color: C.line,
      });
      page.drawText('Confidential — office use. Do not forward outside park staff.', {
        x: MX, y: FOOTER_Y, size: 7, font: this.font, color: C.muted,
      });
      const label = `Page ${i + 1} of ${n}`;
      const w = this.font.widthOfTextAtSize(label, 7);
      page.drawText(label, {
        x: PAGE_W - MX - w, y: FOOTER_Y, size: 7, font: this.font, color: C.muted,
      });
    });
  }

  need(h: number) {
    if (this.y - h < CONTENT_BOTTOM) this.newPage();
  }

  section(title: string) {
    this.need(28);
    this.y -= 10;
    this.page.drawRectangle({ x: MX, y: this.y - 2, width: 3, height: 14, color: C.gold });
    this.page.drawText(title.toUpperCase(), {
      x: MX + 10, y: this.y, size: 9, font: this.bold, color: C.rust,
    });
    this.y -= 16;
  }

  boxHeight(width: number, value: string) {
    const lines = wrap(this.font, value || '—', 10, width - 12);
    return 16 + lines.length * 13 + 6;
  }

  drawBox(x: number, top: number, width: number, h: number, label: string, value: string) {
    const lines = wrap(this.font, value || '—', 10, width - 12);
    this.page.drawRectangle({
      x, y: top - h, width, height: h,
      color: C.white,
      borderColor: C.line,
      borderWidth: 0.6,
    });
    this.page.drawText(label.toUpperCase(), {
      x: x + 6, y: top - 12, size: 6.5, font: this.bold, color: C.muted,
    });
    lines.forEach((line, i) => {
      this.page.drawText(line, {
        x: x + 6, y: top - 26 - i * 13, size: 10, font: this.font, color: C.text,
      });
    });
  }

  row(fields: Array<[string, string]>) {
    const gap = 8;
    const n = fields.length;
    const width = (CONTENT_W - gap * (n - 1)) / n;
    const maxH = Math.max(...fields.map(([, value]) => this.boxHeight(width, value)));
    this.need(maxH + 8);
    const top = this.y;
    fields.forEach(([label, value], i) => {
      this.drawBox(MX + i * (width + gap), top, width, maxH, label, value);
    });
    this.y = top - maxH - 8;
  }

  stack(label: string, value: string) {
    this.row([[label, value]]);
  }

  longStack(label: string, value: string) {
    const lines = wrap(this.font, value || 'None', 10, CONTENT_W - 12);
    this.need(28);
    this.page.drawText(label.toUpperCase(), {
      x: MX, y: this.y, size: 6.5, font: this.bold, color: C.muted,
    });
    this.y -= 14;
    lines.forEach(line => {
      this.need(13);
      this.page.drawText(line, { x: MX, y: this.y, size: 10, font: this.font, color: C.text });
      this.y -= 13;
    });
    this.y -= 8;
  }

  checkbox(label: string, checked: boolean) {
    this.need(16);
    const box = 9;
    this.page.drawRectangle({
      x: MX, y: this.y - 1, width: box, height: box,
      borderColor: C.deep, borderWidth: 0.8, color: C.white,
    });
    if (checked) {
      this.page.drawText('X', {
        x: MX + 1.6, y: this.y, size: 8, font: this.bold, color: C.rust,
      });
    }
    const lines = wrap(this.font, label, 8.5, CONTENT_W - 18);
    lines.forEach((line, i) => {
      this.need(12);
      this.page.drawText(line, {
        x: MX + 14, y: this.y - i * 11, size: 8.5, font: this.font, color: C.text,
      });
    });
    this.y -= Math.max(14, lines.length * 11 + 4);
  }

  note(text: string) {
    const lines = wrap(this.font, text, 8, CONTENT_W);
    this.need(lines.length * 11 + 4);
    lines.forEach(line => {
      this.page.drawText(line, { x: MX, y: this.y, size: 8, font: this.font, color: C.muted });
      this.y -= 11;
    });
    this.y -= 4;
  }

  blankLine(label: string) {
    this.need(22);
    this.page.drawText(label, { x: MX, y: this.y, size: 9, font: this.font, color: C.muted });
    const lw = this.font.widthOfTextAtSize(label, 9);
    this.page.drawLine({
      start: { x: MX + lw + 8, y: this.y - 1 },
      end: { x: PAGE_W - MX, y: this.y - 1 },
      thickness: 0.6,
      color: C.line,
    });
    this.y -= 20;
  }
}

function petSummary(p: PetRecord, i: number): Array<[string, string]> {
  return [
    [`Pet ${i + 1} name`, p.name],
    ['Breed', p.breed],
    ['Weight (lbs)', p.weight],
    ['Age', p.age],
    ['Sex', p.sex],
    ['Spayed / Neutered', p.fixed ? 'Yes' : 'No'],
    ['Vaccinations current', p.vaccinated ? 'Yes' : 'No'],
  ];
}

function housingBlock(h: HousingRecord, title: string, paint: FormPainter) {
  paint.note(title);
  paint.stack('Address or park name', h.address);
  paint.row([['Dates', h.dates], ['Type', h.type]]);
  paint.stack('Reason for leaving', h.reason);
  paint.row([
    ['Landlord / manager', h.contactName],
    ['Phone', h.contactPhone ? formatPhone(h.contactPhone) : ''],
    ['Email', h.contactEmail],
  ]);
}

export async function buildMonthlyApplicationPdf(app: MonthlyApplication): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const p = new FormPainter(doc, font, bold);

  const name = fullName(app);
  p.page.drawRectangle({
    x: MX, y: p.y - 28, width: CONTENT_W, height: 28,
    color: C.sand,
  });
  p.page.drawText(`Submitted  ${formatSubmittedAt(app.submittedAt)}`, {
    x: MX + 8, y: p.y - 18, size: 8, font, color: C.text,
  });
  const meta = [
    app.number ? `Application #${app.number}` : '',
    app.id ? `ID ${app.id.slice(0, 8)}` : '',
  ].filter(Boolean).join('   ·   ');
  if (meta) {
    const w = font.widthOfTextAtSize(meta, 8);
    p.page.drawText(meta, { x: PAGE_W - MX - 8 - w, y: p.y - 18, size: 8, font, color: C.muted });
  }
  p.y -= 40;

  p.section('Applicant information');
  p.row([['First name', app.firstName], ['Last name', app.lastName]]);
  p.row([['Email', app.email], ['Phone', formatPhone(app.phone)]]);
  p.stack('Mailing address', app.mailingAddress);
  p.row([
    ['Date of birth', formatIsoDate(app.dateOfBirth)],
    ['Stayed at CRR before?', app.returningGuest || '—'],
  ]);

  p.section('Stay details');
  p.row([
    ['Requested move-in', formatIsoDate(app.moveInDate)],
    ['Requested move-out', formatIsoDate(app.moveOutDate)],
  ]);
  p.note(`Monthly season ends ${app.seasonEndLabel}. All monthly guests must vacate by ${app.seasonEndLabel}.`);

  p.section('RV information');
  p.row([['Year', app.rvYear], ['Make', app.rvMake], ['Model', app.rvModel]]);
  p.row([
    ['Length (ft)', app.rvLength],
    ['Age of RV (years)', app.rvAge],
    ['Rig type', app.rigType],
  ]);
  p.stack('RV insurance provider', app.rvInsurance);

  p.section('Occupants (max 3)');
  if (app.occupants.length === 0) p.note('None listed.');
  else app.occupants.forEach((o, i) => p.stack(`Occupant ${i + 1}`, o));

  p.section('Pets (max 2)');
  if (app.pets.length === 0) {
    p.note('No pets listed.');
  } else {
    app.pets.forEach((pet, i) => {
      const fields = petSummary(pet, i);
      p.row(fields.slice(0, 4));
      p.row(fields.slice(4));
    });
    p.checkbox('Pet owner declaration acknowledged (not aggressive; liable for damages; leash rules; may be required to leave if a nuisance).', app.petConsent);
  }

  p.section('Vehicles (max 2)');
  if (app.vehicles.length === 0) p.note('None listed.');
  else app.vehicles.forEach((v, i) => p.stack(`Vehicle ${i + 1}`, v));

  p.section('Housing / rental history (past 3 years)');
  if (app.histories.length === 0) p.note('None listed.');
  else {
    const titles = ['Most recent residence', 'Previous residence', 'Additional residence'];
    app.histories.forEach((h, i) => housingBlock(h, titles[i] ?? `Residence ${i + 1}`, p));
  }

  p.section('Additional notes');
  p.longStack('Applicant notes', app.notes || 'None');

  p.section('Acknowledgment & consent');
  p.checkbox(`I consent to a background check as part of this application.`, app.consent);
  p.checkbox(`I understand the monthly season ends ${app.seasonEndLabel} and I must vacate by ${app.seasonEndLabel}.`, app.consent);
  p.checkbox('I have read and accept the Park Rules & Policies.', app.consent);
  p.checkbox('I will provide proof of RV insurance before check-in.', app.consent);
  p.checkbox('I understand RVs must be no more than 10 years old unless approved after in-person inspection.', app.consent);
  p.checkbox('All information in this application is true and accurate to the best of my knowledge.', app.consent);
  p.note(`Electronic signature: ${name}  ·  ${formatSubmittedAt(app.submittedAt)}`);

  p.section('Office use only');
  p.blankLine('Site assigned');
  p.blankLine('Background check');
  p.blankLine('Insurance received');
  p.blankLine('Decision  (Approved / Denied / Waitlist)');
  p.blankLine('Staff initials / date');
  p.blankLine('Notes');

  p.finishFooters();
  doc.setTitle(`Monthly application — ${name}`);
  doc.setAuthor('Crooked River Ranch RV Park');
  doc.setSubject('Winter monthly stay application');
  doc.setCreator('CRR RV Park website');
  return doc.save();
}
