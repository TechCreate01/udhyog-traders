#!/usr/bin/env node
"use strict";

/**
 * Builds the downloadable PDFs in assets/catalogue/.
 * Plain Node, no dependencies - writes PDF 1.4 with uncompressed text streams.
 *
 *   node tools/make-catalogues.js
 *
 * Edit the copy below and re-run. Layout flows from the top of the page and
 * spills onto a new sheet automatically, so long copy cannot run into the footer.
 */

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "assets", "catalogue");

/* A4 in points */
const PW = 595.28;
const PH = 841.89;
const M = 56;
const CW = PW - M * 2; // 483.28
const TOP = PH - M;
const FLOOR = 88; // content must stay above this

const C = {
  ink: "0.051 0.067 0.090",
  body: "0.294 0.333 0.388",
  steel: "0.443 0.478 0.522",
  line: "0.894 0.906 0.925",
  sand: "0.965 0.957 0.941",
  accent: "0.949 0.416 0.106",
  white: "1 1 1",
  dim: "0.741 0.773 0.816",
  faint: "0.239 0.267 0.302",
};

const num = (v) => String(Math.round(v * 100) / 100);
const esc = (s) => String(s).replace(/[\\()]/g, (m) => "\\" + m);
const est = (s, size, bold) => String(s).length * size * (bold ? 0.555 : 0.5);

/* --------------------------------------------------------------------------
   Page primitives
   -------------------------------------------------------------------------- */

class Page {
  constructor() {
    this.ops = [];
  }

  rect(x, y, w, h, color) {
    this.ops.push(`${color} rg ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`);
  }

  line(x1, y1, x2, y2, color, weight = 0.8) {
    this.ops.push(`${num(weight)} w ${color} RG ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`);
  }

  text(str, x, y, { size = 9, bold = false, color = C.ink } = {}) {
    this.ops.push(
      `BT /${bold ? "F2" : "F1"} ${num(size)} Tf ${color} rg 1 0 0 1 ${num(x)} ${num(y)} Tm (${esc(str)}) Tj ET`
    );
  }
}

function wrap(str, width, size, bold) {
  const words = String(str).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? cur + " " + word : word;
    if (cur && est(next, size, bold) > width) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/* --------------------------------------------------------------------------
   Flowing document
   -------------------------------------------------------------------------- */

class Doc {
  constructor(label) {
    this.footerLabel = label;
    this.pages = [];
    this.newPage();
  }

  newPage() {
    const page = new Page();
    page.rect(0, 0, PW, PH, C.white);
    page.line(M, 64, PW - M, 64, C.line, 0.7);
    page.text(this.footerLabel, M, 48, { size: 7.2, color: C.steel });
    page.text("UDHYOG TRADERS  |  PACKAGING & DISPOSABLES", PW - M - est("UDHYOG TRADERS  |  PACKAGING & DISPOSABLES", 7.2, false), 48, {
      size: 7.2,
      color: C.steel,
    });
    this.pages.push(page);
    this.page = page;
    this.y = TOP;
  }

  ensure(height) {
    if (this.y - height < FLOOR) this.newPage();
  }

  space(h) {
    this.y -= h;
  }

  rule(color = C.line, weight = 0.8, before = 6, after = 16) {
    this.ensure(before + after + 2);
    this.y -= before;
    this.page.line(M, this.y, PW - M, this.y, color, weight);
    this.y -= after;
  }

  label(text) {
    this.ensure(26);
    this.page.text(text.toUpperCase(), M, this.y, { size: 7.4, bold: true, color: C.accent });
    this.y -= 18;
  }

  heading(text) {
    this.ensure(34);
    this.page.text(text, M, this.y, { size: 15, bold: true });
    this.y -= 22;
  }

  para(text, { size = 8.8, leading = 13.2, color = C.body, bold = false, width = CW, gap = 10, x = M } = {}) {
    const lines = wrap(text, width, size, bold);
    this.ensure(lines.length * leading + gap);
    for (const line of lines) {
      this.page.text(line, x, this.y, { size, bold, color });
      this.y -= leading;
    }
    this.y -= gap;
  }

  lead(text) {
    this.para(text, { size: 10.2, leading: 15.4, color: C.steel, gap: 20, width: 400 });
  }

  bullets(items, { size = 8.6, leading = 12.6, gap = 5, width = CW, x = M } = {}) {
    for (const item of items) {
      const lines = wrap(item, width - 14, size, false);
      this.ensure(lines.length * leading + gap + 2);
      this.page.rect(x, this.y + 2.4, 2.6, 2.6, C.accent);
      lines.forEach((line, i) => this.page.text(line, x + 12, this.y - i * leading, { size, color: C.body }));
      this.y -= lines.length * leading + gap;
    }
  }

  twoCol(items, { colW = (CW - 18) / 2, gap = 18, size = 8.3, leading = 11.8, x = M } = {}) {
    for (let i = 0; i < items.length; i += 2) {
      const pair = [items[i], items[i + 1]].filter(Boolean);
      const cells = pair.map((it) => {
        const head = wrap(it.h, colW, 10.2, true);
        const body = wrap(it.d, colW, size, false);
        return { head, body, height: 14 + head.length * 13 + body.length * leading + 10 };
      });
      const rowH = Math.max(...cells.map((c) => c.height));
      this.ensure(rowH);
      pair.forEach((it, ci) => {
        const cx = x + ci * (colW + gap);
        let y = this.y;
        this.page.text(cells[ci].head[0], cx, y, { size: 10.2, bold: true });
        y -= 14;
        cells[ci].head.slice(1).forEach((line) => {
          this.page.text(line, cx, y, { size: 10.2, bold: true });
          y -= 13;
        });
        cells[ci].body.forEach((line) => {
          this.page.text(line, cx, y, { size, color: C.body });
          y -= leading;
        });
      });
      this.y -= rowH;
    }
  }

  table(cols, rows, { size = 8.2, headSize = 7.2, rowH = 22 } = {}) {
    const total = cols.reduce((s, c) => s + c.w, 0);
    const widths = cols.map((c) => (c.w / total) * CW);
    this.ensure(rowH * (rows.length + 1) + 8);
    this.page.rect(M, this.y - rowH + 6, CW, rowH, C.sand);
    let x = M + 10;
    cols.forEach((col, i) => {
      this.page.text(col.label.toUpperCase(), x, this.y - 6, { size: headSize, bold: true, color: C.faint });
      x += widths[i];
    });
    this.y -= rowH;
    for (const row of rows) {
      if (this.y - rowH < FLOOR) {
        this.newPage();
      }
      let cx = M + 10;
      row.forEach((cell, i) => {
        this.page.text(cell, cx, this.y - 7, { size, color: i === 0 ? C.ink : C.body, bold: i === 0 });
        cx += widths[i];
      });
      this.page.line(M, this.y - rowH + 3, PW - M, this.y - rowH + 3, C.line, 0.6);
      this.y -= rowH;
    }
    this.y -= 12;
  }

  notice(text) {
    this.ensure(46);
    this.page.rect(M, this.y - 30, 3, 34, C.accent);
    const lines = wrap(text, CW - 24, 8.4, false);
    lines.forEach((line, i) => this.page.text(line, M + 14, this.y - 8 - i * 12.4, { size: 8.4, color: C.steel }));
    this.y -= Math.max(46, lines.length * 12.4 + 18);
  }

  contact(options) {
    const heading = (options && options.heading) || "Start a conversation";
    const note = (options && options.note) || null;
    const height = note ? 120 : 100;
    this.ensure(height + 20);
    const top = this.y;
    this.page.rect(M, top - height, CW, height, C.ink);
    this.page.text(heading, M + 22, top - 30, { size: 11.5, bold: true, color: C.white });
    this.page.text("+91 98250 41230   |   sales@udhyogtraders.in   |   udhyogtraders.in", M + 22, top - 50, {
      size: 8.6,
      color: C.dim,
    });
    this.page.text("Plot 42, Phase II, GIDC Estate, Vatva, Ahmedabad 382445, Gujarat", M + 22, top - 68, {
      size: 8.6,
      color: C.dim,
    });
    if (note) this.page.text(note, M + 22, top - 90, { size: 8.2, color: C.dim });
    this.y = top - height - 20;
  }
}

/* --------------------------------------------------------------------------
   Document 1 - full catalogue (4 pages)
   -------------------------------------------------------------------------- */

function catalogueCover() {
  const p = new Page();
  p.rect(0, 0, PW, PH, C.ink);
  p.rect(M, 706, 40, 4, C.accent);
  p.text("UDHYOG TRADERS", M, 670, { size: 10, bold: true, color: C.white });
  p.text("PACKAGING & DISPOSABLES  |  AHMEDABAD, INDIA", M, 650, { size: 8, color: C.dim });

  p.text("Product", M, 566, { size: 46, bold: true, color: C.white });
  p.text("Catalogue", M, 512, { size: 46, bold: true, color: C.white });
  p.text("2026 EDITION", M, 472, { size: 10.5, bold: true, color: C.accent });

  p.line(M, 442, PW - M, 442, C.faint, 1);
  const intro = [
    "Corrugated boxes, paper bags, food-grade disposables, films and tableware -",
    "manufactured and supplied from our Vatva plant for FMCG, QSR, e-commerce",
    "and hospitality customers across India.",
  ];
  intro.forEach((line, i) => p.text(line, M, 412 - i * 16, { size: 9.8, color: C.dim }));

  p.line(M, 322, PW - M, 322, C.faint, 0.8);
  p.text("INSIDE", M, 298, { size: 7.4, bold: true, color: C.accent });
  const contents = [
    ["01", "Ranges & monthly capacity"],
    ["02", "Materials & traded range"],
    ["03", "Quality, documentation & ordering"],
  ];
  contents.forEach(([n, t], i) => {
    const x = M + i * 152;
    p.text(n, x, 274, { size: 9, bold: true, color: C.accent });
    p.text(t, x, 258, { size: 8.6, color: C.dim });
  });

  p.line(M, 216, PW - M, 216, C.faint, 0.8);
  p.text("WORKS", M, 190, { size: 7.4, bold: true, color: C.accent });
  p.text("Plot 42, Phase II, GIDC Estate, Vatva, Ahmedabad 382445, Gujarat", M, 174, { size: 9.2, color: C.dim });
  p.text("CONTACT", M, 140, { size: 7.4, bold: true, color: C.accent });
  p.text("+91 98250 41230   |   sales@udhyogtraders.in", M, 124, { size: 9.2, color: C.dim });
  p.text("ISO 9001:2015   |   FSSAI 10024051000123   |   GSTIN 24AABCU9603R1ZX", M, 96, {
    size: 7.6,
    color: C.steel,
  });
  return p;
}

function catalogueRanges() {
  const d = new Doc("PRODUCT CATALOGUE 2026  |  RANGES & CAPACITY");
  d.heading("Ranges & monthly capacity");
  d.lead(
    "Six supply lines under one roof, supported by a trading desk for the consumables that go with them. Typical orders start at 5,000 pieces per SKU and repeat monthly."
  );

  d.twoCol([
    {
      h: "Corrugated boxes",
      d: "Shipping cartons, mono cartons and courier mailers in 3, 5 and 7 ply, printed in one or two colours to your dieline.",
    },
    {
      h: "Paper & carry bags",
      d: "Kraft and white bags with twisted, flat or die-cut handles, 120 to 200 GSM, plain or printed.",
    },
    {
      h: "Food-grade disposables",
      d: "Bagasse plates and clamshells, areca leaf plates, paper cups, wooden cutlery and foil containers.",
    },
    {
      h: "Films, tapes & wraps",
      d: "Stretch and shrink film, BOPP tape, bubble wrap, LDPE bags and paper void fill.",
    },
    {
      h: "Tableware & service",
      d: "Napkins, tissue rolls, cutlery kits, gloves, straws and takeaway trays for front-of-house use.",
    },
    {
      h: "Custom print & branding",
      d: "Flexo and offset printing with food-safe inks, dieline development and batch or expiry coding.",
    },
  ]);

  d.space(14);
  d.label("Monthly capacity");
  d.table(
    [
      { label: "Line", w: 165 },
      { label: "Equipment", w: 175 },
      { label: "Capacity / month", w: 143 },
    ],
    [
      ["Corrugation", "2 lines, 1,200 mm", "400 tonnes"],
      ["Printing", "2 and 4 colour flexo", "1.2 million cartons"],
      ["Box making", "4 stitchers / gluers", "1.5 million cartons"],
      ["Paper bags", "3 bag machines", "6 million bags"],
      ["Food-grade moulding", "5 press lines", "12 million pieces"],
      ["Film converting", "4 slitters", "250 tonnes"],
    ]
  );

  d.notice(
    "Capacity figures reflect two-shift working and are reviewed quarterly. Peak-season requirements are quoted against a firm release schedule."
  );
  return d.pages;
}

function catalogueMaterials() {
  const d = new Doc("PRODUCT CATALOGUE 2026  |  MATERIALS");
  d.heading("Materials & traded range");
  d.lead(
    "Paper and resin are bought against the specification, not from whatever is on the rack. Incoming lot numbers are recorded against the production batch."
  );

  d.label("Materials we convert");
  d.bullets([
    "Kraft and recycled linerboard, 120 to 230 GSM, FSC-certified on request",
    "Food-grade virgin board and grease-resistant liners for direct contact",
    "Bagasse moulded pulp and areca leaf for compostable tableware",
    "PP, HDPE, LDPE, BOPP and PET films, plus aluminium foil",
    "Water-based, food-safe inks and adhesives",
  ]);

  d.space(8);
  d.label("Traded range");
  d.bullets([
    "Stretch, shrink and cling film in machine and hand rolls",
    "BOPP, masking and paper tapes; PP strapping",
    "Bubble wrap, air pillows and kraft void fill",
    "Courier mailers, poly bags and courier boxes",
    "Tissue, napkins, cutlery, straws and gloves",
  ]);

  d.rule();
  d.label("Standards we work to");
  d.table(
    [
      { label: "Standard", w: 110 },
      { label: "Applies to", w: 373 },
    ],
    [
      ["IS 2771", "Paper for food packaging and direct-contact use"],
      ["FSSAI Sch. IV", "Food-contact materials, migration and labelling"],
      ["ASTM D642", "Compression strength of shipping containers"],
      ["TAPPI T810", "Burst strength of corrugated board"],
      ["ISTA 3A", "Transit performance for parcel delivery"],
    ]
  );

  d.label("Printing & finishing");
  d.para(
    "Flexo printing in one or two colours as standard, with four-colour available on longer runs. Water-based inks are used throughout the food-grade range, and cartons carry batch, manufacture and expiry coding where the SKU requires it.",
    { size: 8.7, leading: 13, width: CW }
  );

  d.notice(
    "Declarations: FSSAI food-contact declarations and lot-level test reports are issued with food-grade consignments, and copies are retained for five years."
  );
  return d.pages;
}

function catalogueQuality() {
  const d = new Doc("PRODUCT CATALOGUE 2026  |  QUALITY & ORDERING");
  d.heading("Quality, documentation & ordering");
  d.lead(
    "Every lot leaves here checked, coded and traceable to the paper or resin batch it came from, so your QA gate has something to work with."
  );

  d.label("How we hold the specification");
  d.bullets([
    "Incoming board checked for GSM, calliper and moisture against the spec sheet",
    "Burst strength and ECT tested on every paper lot, results logged",
    "Print registration, glue line and crease checked at first-off and mid-run",
    "Food-contact papers and inks verified against supplier declarations",
    "Rejection and CAPA records kept per customer, reviewed monthly",
  ]);

  d.space(8);
  d.label("Documentation pack");
  d.bullets([
    "Lot-wise test report for burst strength, ECT and GSM",
    "FSSAI food-contact declaration for food-grade SKUs",
    "Batch code with manufacture and expiry date on cartons and labels",
    "Packing list matched to your bundle or pallet requirement",
    "Signed specimen and dieline revision on file per SKU",
  ]);

  d.rule();
  d.label("How to order");
  const steps = [
    ["01", "Send the spec", "A SKU list, dieline or a sample of the pack you use today. Include quantity and target date."],
    ["02", "Review & quote", "We check size, board grade, print and food-contact needs, then price within 2 working days."],
    ["03", "Sample & approval", "A printed or moulded sample goes out for sign-off before the production run is released."],
    ["04", "Run & dispatch", "Production follows your schedule and ships with the full documentation pack."],
  ];
  for (const [n, h, t] of steps) {
    d.ensure(54);
    d.page.text(n, M, d.y, { size: 9, bold: true, color: C.accent });
    d.page.text(h, M + 26, d.y, { size: 9.6, bold: true });
    const lines = wrap(t, CW - 26, 8.3, false);
    lines.forEach((line, i) => d.page.text(line, M + 26, d.y - 14 - i * 11.8, { size: 8.3, color: C.body }));
    d.y -= 14 + lines.length * 11.8 + 12;
  }

  d.space(10);
  d.contact({ note: "ISO 9001:2015  |  FSSAI 10024051000123  |  GSTIN 24AABCU9603R1ZX" });
  return d.pages;
}

/* --------------------------------------------------------------------------
   Document 2 - corrugated packaging brochure
   -------------------------------------------------------------------------- */

function corrugatedBrochure() {
  const d = new Doc("BROCHURE  |  CORRUGATED PACKAGING");
  d.heading("Corrugated Boxes & Cartons");
  d.lead(
    "Shipping cartons, retail mono cartons and courier mailers - cut, creased and printed to your dieline, in board grades chosen for the load and the journey."
  );

  d.label("Board grades");
  d.table(
    [
      { label: "Grade", w: 130 },
      { label: "Construction", w: 165 },
      { label: "Typical use", w: 188 },
    ],
    [
      ["3-ply ECT 20", "Kraft / liner 120 GSM", "Light retail and e-commerce"],
      ["3-ply ECT 26", "Kraft / liner 150 GSM", "FMCG cartons, up to 12 kg"],
      ["5-ply ECT 32", "Kraft / liner 150-180 GSM", "Shipping cartons, 15-25 kg"],
      ["5-ply ECT 44", "Heavy liner 200 GSM", "Industrial and export packs"],
      ["7-ply", "Heavy liner, double wall", "Fragile and high-stack loads"],
    ]
  );

  d.label("Box styles");
  d.table(
    [
      { label: "Style", w: 175 },
      { label: "Description", w: 308 },
    ],
    [
      ["Regular slotted (RSC)", "Standard shipping carton, glued or stitched"],
      ["Full overlap (FOL)", "Extra bottom strength for heavy contents"],
      ["Die-cut mailer", "Self-locking, no tape needed for closure"],
      ["Tray & lid", "Shallow packs for produce and bakery"],
      ["Mono carton", "Printed retail pack, offset or flexo"],
    ]
  );

  d.label("Print & tooling");
  d.para(
    "Flexo printing in one or two colours with water-based inks, four-colour on longer runs. Cutting dies and printing plates are made in 3 to 5 working days from an approved dieline, and are stored for repeat orders so the second run matches the first.",
    { size: 8.7, leading: 13 }
  );

  d.notice(
    "Monthly capacity: about 400 tonnes of board across two corrugators, 1.2 million printed cartons and 1.5 million box conversions, run over two shifts."
  );

  d.contact({ heading: "Send a size or a dieline for quoting" });
  return d.pages;
}

/* --------------------------------------------------------------------------
   Document 3 - food-grade disposables brochure
   -------------------------------------------------------------------------- */

function disposablesBrochure() {
  const d = new Doc("BROCHURE  |  FOOD-GRADE DISPOSABLES");
  d.heading("Food-grade Disposables & Tableware");
  d.lead(
    "Serveware for takeaway counters, caterers and cloud kitchens - with the food-contact paperwork your buyer will ask for at the first audit."
  );

  d.label("Product list");
  d.table(
    [
      { label: "Product", w: 165 },
      { label: "Sizes", w: 170 },
      { label: "Packing", w: 148 },
    ],
    [
      ["Bagasse plate", '6", 8", 10"', "500 per carton"],
      ["Bagasse clamshell", "8 x 8, 9 x 6", "500 per carton"],
      ["Compartment tray", "3 CP and 5 CP", "400 per carton"],
      ["Areca leaf plate", '6" to 12"', "100 per bundle"],
      ["Paper cup", "150, 200, 250, 350 ml", "1,000 per carton"],
      ["Wooden cutlery", "140 / 160 mm", "1,000 per carton"],
      ["Foil container", "250 to 750 ml", "500 per carton"],
    ]
  );

  d.label("Materials");
  d.bullets([
    "Bagasse moulded pulp - compostable, microwave safe, no plastic lining",
    "Areca leaf - natural, biodegradable, available coated or uncoated",
    "Virgin food-grade paperboard for cups and takeaway boxes",
    "Birchwood cutlery and paper straws for zero-plastic counters",
    "Aluminium foil containers for hot and oven-ready items",
  ]);

  d.rule();
  d.label("Food contact");
  d.para(
    "Direct-contact items are supplied with an FSSAI declaration and the supplier migration-test certificate for the lot. Inks and adhesives in the food-grade range are water-based and approved for indirect contact; where a printed surface faces the food, we specify a food-safe varnish instead.",
    { size: 8.7, leading: 13 }
  );

  d.notice(
    "Monthly capacity: about 12 million moulded and pressed pieces across five lines, packed to your carton count and batch coded at the press."
  );

  d.contact({ heading: "Ask for a sample pack" });
  return d.pages;
}

/* --------------------------------------------------------------------------
   Document 4 - quality & compliance summary
   -------------------------------------------------------------------------- */

function qualitySheet() {
  const d = new Doc("QUALITY & COMPLIANCE SUMMARY");
  d.heading("Quality & Compliance");
  d.lead(
    "Testing sits next to the corrugator, not in a separate office, so a weak board is caught before it becomes a thousand weak boxes."
  );

  d.label("System & registration");
  d.ensure(60);
  const boxTop = d.y;
  d.page.rect(M, boxTop - 54, CW, 54, C.sand);
  d.page.text("ISO 9001:2015", M + 18, boxTop - 22, { size: 13, bold: true });
  d.page.text("Quality management system, certified since 2018", M + 18, boxTop - 40, { size: 8.4, color: C.body });
  d.page.text("FSSAI 10024051000123", M + 300, boxTop - 22, { size: 8.4, bold: true });
  d.page.text("GSTIN 24AABCU9603R1ZX", M + 300, boxTop - 40, { size: 8.4, color: C.body });
  d.y = boxTop - 54 - 20;

  d.label("Testing equipment");
  d.table(
    [
      { label: "Instrument", w: 220 },
      { label: "Purpose", w: 263 },
    ],
    [
      ["Burst strength tester", "Board and box burst strength"],
      ["ECT jig and compression frame", "Edge crush and stacking strength"],
      ["GSM cutter and calliper", "Board weight and thickness"],
      ["Moisture meter", "Paper moisture at incoming and dispatch"],
      ["Print registration gauge", "Flexo print alignment"],
      ["Weighing scale (calibrated)", "Carton count verification"],
    ]
  );

  d.label("Documentation with every dispatch");
  d.bullets([
    "Lot-wise test report covering burst strength, ECT and GSM",
    "Batch code with manufacture and expiry date on the pack",
    "FSSAI food-contact declaration for food-grade SKUs",
    "Packing list matched to your bundle or pallet requirement",
  ]);

  d.label("Traceability");
  d.para(
    "Incoming lot numbers are recorded against the production batch and retained for five years, so a declaration can be reproduced long after the consignment has been consumed. Rejection and CAPA records are maintained per customer and reviewed monthly.",
    { size: 8.5, leading: 13 }
  );

  d.space(8);
  d.contact({
    heading: "Request an audit pack",
    note: "Vendor onboarding forms, ISO certificate and FSSAI licence copies on request.",
  });
  return d.pages;
}

/* --------------------------------------------------------------------------
   PDF writer
   -------------------------------------------------------------------------- */

function makePdf(pages, meta) {
  const objs = [];
  const pageObj = (i) => 5 + i * 2;
  const contentObj = (i) => 6 + i * 2;

  objs[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[1] =
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] ` +
    `/Count ${pages.length} >>`;
  objs[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  pages.forEach((page, i) => {
    const stream = page.ops.join("\n");
    objs[4 + i * 2] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PW)} ${num(PH)}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObj(i)} 0 R >>`;
    objs[5 + i * 2] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  });

  objs.push(
    `<< /Title (${esc(meta.title)}) /Author (${esc("Udhyog Traders")}) ` +
      `/Subject (${esc(meta.subject)}) /Creator (${esc("Udhyog Traders catalogue builder")}) >>`
  );

  const infoNum = objs.length;
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((body, idx) => {
    offsets[idx] = Buffer.byteLength(out, "latin1");
    out += `${idx + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => {
    out += `${String(o).padStart(10, "0")} 00000 n \n`;
  });
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${infoNum} 0 R >>\n`;
  out += `startxref\n${xref}\n%%EOF\n`;

  return { buffer: Buffer.from(out, "latin1"), pages: pages.length };
}

/* --------------------------------------------------------------------------
   Build
   -------------------------------------------------------------------------- */

const docs = [
  {
    file: "udhyog-traders-product-catalogue-2026.pdf",
    title: "Udhyog Traders - Product Catalogue 2026",
    subject: "Ranges, capacity, materials and quality",
    pages: [catalogueCover, catalogueRanges, catalogueMaterials, catalogueQuality],
  },
  {
    file: "udhyog-traders-corrugated-packaging-brochure.pdf",
    title: "Udhyog Traders - Corrugated Packaging Brochure",
    subject: "Board grades, box styles, print and capacity",
    pages: [corrugatedBrochure],
  },
  {
    file: "udhyog-traders-food-grade-disposables-brochure.pdf",
    title: "Udhyog Traders - Food-grade Disposables Brochure",
    subject: "Bagasse, areca, paper and foil serveware",
    pages: [disposablesBrochure],
  },
  {
    file: "udhyog-traders-quality-compliance.pdf",
    title: "Udhyog Traders - Quality & Compliance Summary",
    subject: "Certification, testing and documentation",
    pages: [qualitySheet],
  },
];

fs.mkdirSync(OUT, { recursive: true });

for (const doc of docs) {
  const pages = doc.pages.flatMap((fn) => {
    const result = fn();
    return Array.isArray(result) ? result : [result];
  });
  const { buffer, pages: count } = makePdf(pages, doc);
  const target = path.join(OUT, doc.file);
  fs.writeFileSync(target, buffer);
  console.log(`${doc.file}  ${count} page(s)  ${(buffer.length / 1024).toFixed(1)} KB`);
}
