#!/usr/bin/env node
"use strict";

/**
 * Builds the downloadable PDFs in assets/catalogue/.
 * Plain Node, no dependencies — writes PDF 1.4 with uncompressed text streams.
 *
 *   node tools/make-catalogues.js
 *
 * Edit the copy below, re-run, and the site's download cards keep working.
 */

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "assets", "catalogue");

/* A4 in points */
const PW = 595.28;
const PH = 841.89;
const M = 56;
const CW = PW - M * 2;

const C = {
  ink: "0.051 0.067 0.090",
  body: "0.294 0.333 0.388",
  steel: "0.424 0.447 0.478",
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
    this.lowest = PH;
  }

  push(op) {
    this.ops.push(op);
    return this;
  }

  rect(x, y, w, h, fill) {
    return this.push(`${fill} rg ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`);
  }

  rule(x, y, w, color = C.line, lw = 1) {
    return this.push(
      `${num(lw)} w ${color} RG ${num(x)} ${num(y)} m ${num(x + w)} ${num(y)} l S`
    );
  }

  text(str, x, y, o = {}) {
    const size = o.size || 10;
    const color = o.color || C.ink;
    const track = o.tracking || 0;
    const tc = track ? ` ${num(track)} Tc` : "";
    const reset = track ? " 0 Tc" : "";
    this.lowest = Math.min(this.lowest, y);
    return this.push(
      `BT ${color} rg ${o.bold ? "/F2" : "/F1"} ${num(size)} Tf${tc} ` +
        `1 0 0 1 ${num(x)} ${num(y)} Tm (${esc(str)}) Tj${reset} ET`
    );
  }

  para(str, x, y, width, o = {}) {
    const size = o.size || 9.5;
    const bold = !!o.bold;
    const lead = o.leading || size * 1.55;
    const words = String(str).split(/\s+/).filter(Boolean);
    let line = "";
    const draw = (ln) => {
      this.text(ln, x, y, { size, bold, color: o.color || C.body });
      y -= lead;
    };
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (est(next, size, bold) > width && line) {
        draw(line);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) draw(line);
    return y + lead;
  }

  bullets(items, x, y, width, o = {}) {
    const size = o.size || 9;
    const lead = size * 1.5;
    for (const item of items) {
      this.rect(x, y + 2.4, 3.6, 3.6, C.accent);
      const last = this.para(item, x + 13, y, width - 13, {
        size,
        color: o.color || C.body,
        leading: lead,
      });
      y = last - (lead + (o.gap === undefined ? 6 : o.gap));
    }
    return y;
  }

  table(x, top, cols, rows, o = {}) {
    const rowH = o.rowH || 24;
    const totalW = cols.reduce((s, c) => s + c.w, 0);
    let cx = x;
    for (const c of cols) {
      this.text(c.label.toUpperCase(), cx, top, {
        size: 7.4,
        bold: true,
        color: C.steel,
        tracking: 0.6,
      });
      cx += c.w;
    }
    this.rule(x, top - 9, totalW, C.accent, 1.1);
    let y = top - 9 - rowH;
    rows.forEach((row, i) => {
      if (i % 2 === 0) this.rect(x, y - 6, totalW, rowH, C.sand);
      let rx = x;
      row.forEach((cell, ci) => {
        this.text(cell, rx, y, {
          size: 8.8,
          bold: ci === 0,
          color: ci === 0 ? C.ink : C.body,
        });
        rx += cols[ci].w;
      });
      y -= rowH;
    });
    return y + rowH;
  }
}

function startPage(label) {
  const p = new Page();
  p.rect(0, PH - 74, PW, 74, C.ink);
  p.text("UDHYOG TRADERS", M, PH - 33, {
    size: 9,
    bold: true,
    color: C.white,
    tracking: 2.4,
  });
  p.text(label, M, PH - 52, { size: 7.4, bold: true, color: C.accent, tracking: 1.2 });
  return p;
}

function finishPage(p) {
  if (p.lowest < 96) throw new Error("content overflows into the footer");
  p.rule(M, 66, CW, C.line, 0.8);
  p.text(
    "Udhyog Traders  |  Vatva GIDC, Ahmedabad  |  +91 98250 41230  |  sales@udhyogtraders.in",
    M,
    52,
    { size: 7.4, color: C.steel }
  );
  return p;
}

function titleBlock(p, title, lead) {
  p.text(title, M, PH - 122, { size: 24, bold: true });
  if (lead) p.para(lead, M, PH - 150, 440, { size: 9.6, color: C.body, leading: 14.5 });
}

function contactStrip(p, y, heading = "Start a conversation") {
  p.rect(M, y - 92, CW, 92, C.ink);
  p.text(heading, M + 22, y - 32, { size: 11.5, bold: true, color: C.white });
  p.text(
    "+91 98250 41230   |   sales@udhyogtraders.in   |   udhyogtraders.in",
    M + 22,
    y - 52,
    { size: 8.6, color: C.dim }
  );
  p.text(
    "Plot 42, Phase II, GIDC Estate, Vatva, Ahmedabad 382445, Gujarat",
    M + 22,
    y - 70,
    { size: 8.6, color: C.dim }
  );
}

function sectionLabel(p, text, y, x = M) {
  p.text(text, x, y, { size: 7.4, bold: true, color: C.accent, tracking: 1.2 });
}

/* --------------------------------------------------------------------------
   Document 1 — full catalogue (4 pages)
   -------------------------------------------------------------------------- */

function catalogueCover() {
  const p = new Page();
  p.rect(0, 0, PW, PH, C.ink);
  p.rect(M, 706, 40, 4, C.accent);
  p.text("UDHYOG TRADERS", M, 670, {
    size: 10,
    bold: true,
    color: C.white,
    tracking: 3.2,
  });
  p.text("MANUFACTURING & SUPPLY  |  AHMEDABAD, INDIA", M, 650, {
    size: 8,
    color: C.dim,
    tracking: 0.9,
  });

  p.text("Product", M, 566, { size: 46, bold: true, color: C.white });
  p.text("Catalogue", M, 512, { size: 46, bold: true, color: C.white });
  p.text("2026 EDITION", M, 472, { size: 10.5, bold: true, color: C.accent, tracking: 2 });

  p.rule(M, 442, CW, C.faint, 1);
  p.para(
    "Precision CNC machining, sheet-metal fabrication, fasteners, castings and transmission components - manufactured and supplied from our Vatva plant for OEMs and maintenance teams across India.",
    M,
    412,
    400,
    { size: 9.8, color: C.dim, leading: 16 }
  );

  p.rule(M, 322, CW, C.faint, 0.8);
  sectionLabel(p, "INSIDE", 298);
  const contents = [
    ["01", "Capabilities & capacity"],
    ["02", "Materials & traded range"],
    ["03", "Quality & contact"],
  ];
  contents.forEach(([n, t], i) => {
    const x = M + i * 152;
    p.text(n, x, 274, { size: 9, bold: true, color: C.accent });
    p.text(t, x, 258, { size: 8.6, color: C.dim });
  });

  p.rule(M, 216, CW, C.faint, 0.8);
  sectionLabel(p, "WORKS", 190);
  p.text("Plot 42, Phase II, GIDC Estate, Vatva, Ahmedabad 382445, Gujarat", M, 174, {
    size: 9.2,
    color: C.dim,
  });
  sectionLabel(p, "CONTACT", 140);
  p.text("+91 98250 41230   |   sales@udhyogtraders.in", M, 124, { size: 9.2, color: C.dim });
  p.text("ISO 9001:2015   |   GSTIN 24AABCU9603R1ZX   |   Udyam-GJ-11-0048216", M, 96, {
    size: 7.6,
    color: C.steel,
  });
  return p;
}

function catalogueCapabilities() {
  const p = startPage("PRODUCT CATALOGUE 2026  |  CAPABILITIES");
  titleBlock(
    p,
    "Capabilities at a glance",
    "Six production lines under one roof, supported by a trading desk for the standard hardware that goes with them. Typical work is 50 to 5,000 pieces per part number, repeated monthly."
  );

  const caps = [
    [
      "CNC machining",
      "Bar-fed turning to dia 65 mm and chuck work to dia 350 mm, 3-axis milling to 1000 x 500 mm, held to +/-0.02 mm.",
    ],
    [
      "Sheet metal",
      "Fibre laser cutting to 12 mm MS and 6 mm SS, press braking to 160 T over a 3 m bed, jig-based MIG and TIG welding.",
    ],
    [
      "Fasteners & fittings",
      "HT bolts (8.8 / 10.9 / 12.9), nuts, washers, anchors, flanges and pipe fittings in MS, SS and HDG.",
    ],
    [
      "Castings & forgings",
      "Grey and SG iron castings to 120 kg, forged flanges, shafts and rings, proof-machined and inspected on arrival.",
    ],
    [
      "Gears & spares",
      "Spur gears, simplex and duplex sprockets, bushes, pulleys and couplings, to drawing or reverse-engineered from sample.",
    ],
    [
      "Assemblies & kitting",
      "Sub-assemblies built and function-tested, plus bagged, labelled and barcoded hardware kits for line-side release.",
    ],
  ];

  caps.forEach(([h, d], i) => {
    const x = M + (i % 2) * 252;
    const y = 606 - Math.floor(i / 2) * 80;
    p.text(h, x, y, { size: 10.4, bold: true });
    p.para(d, x, y - 16, 226, { size: 8.4, color: C.body, leading: 12.6 });
  });

  sectionLabel(p, "MONTHLY CAPACITY", 392);
  p.table(
    M,
    372,
    [
      { label: "Operation", w: 190 },
      { label: "Equipment", w: 120 },
      { label: "Range", w: 173 },
    ],
    [
      ["CNC turning", "6 lathes", "Dia 6-320 mm x 600 mm"],
      ["Vertical machining", "3 centres", "1000 x 500 x 500 mm"],
      ["Laser cutting", "3 kW fibre", "MS 12 mm / SS 6 mm"],
      ["Press braking", "2 brakes", "160 T, 3 m bed"],
      ["Welding", "8 stations", "MIG / TIG on jigs"],
      ["Inspection", "CMM + lab", "FAI and batch reports"],
    ]
  );

  p.rect(M, 172, 3, 34, C.accent);
  p.para(
    "Capacity figures reflect two-shift working and are reviewed quarterly. Peak requirements are quoted against a firm delivery schedule.",
    M + 14,
    194,
    400,
    { size: 8.4, color: C.steel, leading: 12.6 }
  );
  return finishPage(p);
}

function catalogueMaterials() {
  const p = startPage("PRODUCT CATALOGUE 2026  |  MATERIALS");
  titleBlock(
    p,
    "Materials & traded range",
    "Material is bought against the drawing, not from whatever is on the rack. Heat numbers on incoming stock are recorded against the batch."
  );

  sectionLabel(p, "MATERIALS WE PROCESS", 648);
  p.bullets(
    [
      "Mild steel IS 2062 - plates 1.6 to 12 mm, sections, rounds and squares",
      "Stainless steel 304 and 316L - sheet, bar, tube and pipe",
      "Aluminium 6061-T6 and 6082-T6 - plate, bar and extrusion",
      "Brass, phosphor bronze, copper and cast iron FG 200 / 260",
      "Engineering plastics - Delrin, nylon, PTFE, HDPE",
    ],
    M,
    626,
    220,
    { size: 8.4, gap: 4 }
  );

  sectionLabel(p, "TRADED RANGE", 648, M + 252);
  p.bullets(
    [
      "Fasteners - HT bolts, nuts, washers, anchors, spring and nylon insert types",
      "Bearings, seals, belts, pulleys and couplings",
      "Hydraulic and pneumatic fittings, hoses, cylinders and valves",
      "Abrasives, cutting tools, drill bits, taps and welding consumables",
      "Safety PPE, hand tools, lifting gear and MRO hardware",
    ],
    M + 252,
    626,
    220,
    { size: 8.4, gap: 4 }
  );

  sectionLabel(p, "STANDARDS WE WORK TO", 468);
  p.table(
    M,
    448,
    [
      { label: "Standard", w: 110 },
      { label: "Applies to", w: 373 },
    ],
    [
      ["IS 1367", "High-tensile fasteners, property classes 8.8 to 12.9"],
      ["IS 2062", "Structural steel plates, angles, channels and flats"],
      ["IS 800", "Fabricated structures and weld detailing"],
      ["AWS D1.1", "Welding procedure specification and qualification"],
      ["ISO 2768-m", "General dimensional tolerances on machined parts"],
    ]
  );

  sectionLabel(p, "FINISHES", 262);
  p.para(
    "Powder coating, hot-dip galvanising, zinc plating, primer and PU paint, black oxide and anodising. Finishing is carried out by long-standing partners and inspected on return to our plant before dispatch.",
    M,
    242,
    CW,
    { size: 8.6, color: C.body, leading: 13 }
  );

  p.rule(M, 200, CW, C.line, 0.8);
  p.para(
    "Certificates: EN 10204 3.1 mill test certificates are supplied with steel and fasteners on request, with the heat number printed on the packing list.",
    M,
    180,
    CW,
    { size: 8.2, color: C.steel, leading: 12.5 }
  );
  return finishPage(p);
}

function catalogueQuality() {
  const p = startPage("PRODUCT CATALOGUE 2026  |  QUALITY & CONTACT");
  titleBlock(
    p,
    "Quality, documentation & ordering",
    "Every batch leaves here measured, recorded and traceable to the heat number of the material it was made from."
  );

  sectionLabel(p, "HOW WE HOLD TOLERANCE", 648);
  p.bullets(
    [
      "Incoming inspection of bar, plate and castings against the drawing",
      "CMM, profile projector, micrometers, bore and height gauges on the shop floor",
      "First-off, in-process and final inspection logged per part number",
      "First-article inspection reports with ballooned drawings for new parts",
      "Rejection and CAPA records kept per customer, reviewed monthly",
    ],
    M,
    626,
    220,
    { size: 8.4, gap: 4 }
  );

  sectionLabel(p, "DOCUMENTATION PACK", 648, M + 252);
  p.bullets(
    [
      "EN 10204 3.1 mill test certificates with heat numbers",
      "Dimensional inspection report for the batch",
      "First-article inspection report on new part numbers",
      "Packing list matched to your bin or pallet requirement",
      "Weld procedure and qualification records on request",
    ],
    M + 252,
    626,
    220,
    { size: 8.4, gap: 4 }
  );

  sectionLabel(p, "HOW TO ORDER", 430);
  const steps = [
    ["01", "Send the drawing", "PDF, STEP file or a physical sample. Bring the quantity and target date."],
    ["02", "Review & quote", "Our engineer flags tolerance, material and finish, then prices it within 2 working days."],
    ["03", "Sample & approval", "A first article is made for your sign-off before the batch is released."],
    ["04", "Batch & dispatch", "Production runs to schedule, dispatched with the full documentation pack."],
  ];
  steps.forEach(([n, h, d], i) => {
    const x = M + i * 122;
    p.text(n, x, 404, { size: 9, bold: true, color: C.accent });
    p.text(h, x, 388, { size: 9.2, bold: true });
    p.para(d, x, 374, 110, { size: 7.7, color: C.body, leading: 11 });
  });

  contactStrip(p, 290);
  return finishPage(p);
}

/* --------------------------------------------------------------------------
   Document 2 — CNC machining brochure
   -------------------------------------------------------------------------- */

function machiningBrochure() {
  const p = startPage("BROCHURE  |  CNC MACHINING");
  titleBlock(
    p,
    "CNC Machining & Precision Components",
    "Turned, milled and drilled parts for assemblies where the fit matters - shafts, bushes, spacers, housings, adapter plates and sensor brackets."
  );

  sectionLabel(p, "MACHINE LIST", 638);
  p.table(
    M,
    618,
    [
      { label: "Machine", w: 190 },
      { label: "Capacity", w: 190 },
      { label: "Units", w: 103 },
    ],
    [
      ["CNC turning centre", "Dia 6-320 mm x 600 mm", "6"],
      ["Vertical machining centre", "1000 x 500 x 500 mm", "3"],
      ["CNC drilling & tapping", "800 x 400 mm, to M16", "2"],
      ["Cylindrical grinder", "Dia 300 x 800 mm", "2"],
      ["Conventional lathe & mill", "To dia 400 mm", "8"],
    ]
  );

  sectionLabel(p, "TOLERANCES & INSPECTION", 464);
  p.bullets(
    [
      "General machining tolerance +/-0.02 mm; +/-0.005 mm on critical features by agreement",
      "Surface finish Ra 0.4 to 3.2 um depending on process and material",
      "CMM and profile projector inspection, with first-article reports on new parts",
      "Thread, bore and run-out gauges calibrated annually against traceable standards",
    ],
    M,
    442,
    460,
    { size: 8.6, gap: 5 }
  );

  sectionLabel(p, "MATERIALS & VOLUME", 328);
  p.para(
    "Mild steel EN8 / EN19, stainless 304 and 316L, aluminium 6061-T6, brass, cast iron and engineering plastics. Batch sizes from 50 to 5,000 pieces, with annual volumes up to about 50,000 pieces per part number across scheduled monthly releases.",
    M,
    308,
    460,
    { size: 8.8, color: C.body, leading: 13.5 }
  );

  p.rule(M, 250, CW, C.line, 0.8);
  p.para(
    "Fixtures and soft jaws are designed in-house, so a new part number can usually be at first article within ten working days of drawing approval.",
    M,
    230,
    460,
    { size: 8.4, color: C.steel, leading: 12.8 }
  );

  contactStrip(p, 190, "Send a drawing for quoting");
  return finishPage(p);
}

/* --------------------------------------------------------------------------
   Document 3 — fabrication brochure
   -------------------------------------------------------------------------- */

function fabricationBrochure() {
  const p = startPage("BROCHURE  |  SHEET METAL & FABRICATION");
  titleBlock(
    p,
    "Sheet Metal & Structural Fabrication",
    "Guards, machine covers, electrical enclosures, frames, trays and mounting brackets - cut from drawing, formed, welded and finished."
  );

  sectionLabel(p, "PROCESS CAPACITY", 638);
  p.table(
    M,
    618,
    [
      { label: "Process", w: 180 },
      { label: "Capacity", w: 170 },
      { label: "Notes", w: 133 },
    ],
    [
      ["Fibre laser cutting", "3000 x 1500 mm bed", "MS 12 mm, SS 6 mm"],
      ["CNC press brake", "3200 mm, 160 T", "+/-0.3 mm"],
      ["MIG / TIG / SAW", "8 stations", "Jig-controlled"],
      ["Plate rolling", "6 mm x 1500 mm", "Shells and cylinders"],
      ["Powder coating", "Partner line", "60-90 um DFT"],
    ]
  );

  sectionLabel(p, "TYPICAL WORK", 464);
  p.bullets(
    [
      "Machine guards, covers and safety fencing to drawing",
      "Electrical panel enclosures, back plates and cable trays",
      "Base frames, skids, supports and structural sub-frames",
      "Tanks, hoppers and chutes in MS or stainless, welded leak-tight",
      "Brackets, clamps and mounting plates in batch quantities",
    ],
    M,
    442,
    460,
    { size: 8.6, gap: 4 }
  );

  sectionLabel(p, "STANDARDS & INSPECTION", 330);
  p.para(
    "Fabrication follows IS 800 and IS 2062 for structural work, with welding procedures to AWS D1.1 or customer specification. Weld inspection is visual as standard; dye-penetrant and ultrasonic testing are arranged on request, with WPS and PQR records supplied where the job calls for them.",
    M,
    310,
    460,
    { size: 8.8, color: C.body, leading: 13.5 }
  );

  p.rect(M, 232, 3, 44, C.accent);
  p.para(
    "Monthly fabrication capacity is about 45 tonnes across cutting, forming and welding, run over two shifts with a dedicated fit-up bay for large frames.",
    M + 14,
    262,
    430,
    { size: 8.8, color: C.body, leading: 13.5 }
  );

  contactStrip(p, 200, "Send a drawing for quoting");
  return finishPage(p);
}

/* --------------------------------------------------------------------------
   Document 4 — quality & compliance summary
   -------------------------------------------------------------------------- */

function qualitySheet() {
  const p = startPage("QUALITY & COMPLIANCE SUMMARY");
  titleBlock(
    p,
    "Quality & Compliance",
    "Our quality lab sits on the shop floor, not in a separate office, so a deviation is caught at the machine instead of at your gate."
  );

  sectionLabel(p, "SYSTEM & REGISTRATION", 632);
  p.rect(M, 560, CW, 54, C.sand);
  p.text("ISO 9001:2015", M + 18, 596, { size: 13, bold: true });
  p.text("Quality management system, certified since 2014", M + 18, 578, {
    size: 8.4,
    color: C.body,
  });
  p.text("GSTIN 24AABCU9603R1ZX", M + 300, 596, { size: 8.4, bold: true });
  p.text("Udyam-GJ-11-0048216", M + 300, 578, { size: 8.4, color: C.body });

  sectionLabel(p, "INSPECTION EQUIPMENT", 528);
  p.table(
    M,
    508,
    [
      { label: "Instrument", w: 220 },
      { label: "Range", w: 263 },
    ],
    [
      ["Coordinate measuring machine", "600 x 500 x 400 mm"],
      ["Profile projector", "300 mm screen"],
      ["Micrometer and vernier calliper", "0-100 mm / 0-300 mm"],
      ["Bore gauge and height gauge", "18-150 mm / 0-600 mm"],
      ["Hardness tester", "HRB / HRC"],
      ["Surface roughness tester", "Ra 0.05-10 um"],
    ],
    { rowH: 22 }
  );

  sectionLabel(p, "DOCUMENTATION WITH EVERY DISPATCH", 366);
  p.bullets(
    [
      "EN 10204 3.1 mill test certificates with heat numbers",
      "Dimensional inspection report for the batch",
      "First-article inspection report for new part numbers",
      "Packing list matched to your bin or pallet requirement",
    ],
    M,
    344,
    460,
    { size: 8.6, gap: 4 }
  );

  sectionLabel(p, "TRACEABILITY", 254);
  p.para(
    "Heat numbers on incoming material are recorded against the production batch and retained for five years, so a certificate can be reproduced long after the consignment has been consumed. Rejection and CAPA records are maintained per customer and reviewed monthly.",
    M,
    234,
    460,
    { size: 8.4, color: C.body, leading: 13 }
  );

  contactStrip(p, 168, "Request an audit pack");
  return finishPage(p);
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
  objs[2] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[3] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  pages.forEach((page, i) => {
    const stream = page.ops.join("\n");
    objs[4 + i * 2] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PW)} ${num(PH)}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObj(i)} 0 R >>`;
    objs[5 + i * 2] =
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
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
    subject: "Capabilities, materials and quality",
    pages: [catalogueCover, catalogueCapabilities, catalogueMaterials, catalogueQuality],
  },
  {
    file: "udhyog-traders-cnc-machining-brochure.pdf",
    title: "Udhyog Traders - CNC Machining Brochure",
    subject: "Machine list, tolerances and materials",
    pages: [machiningBrochure],
  },
  {
    file: "udhyog-traders-fabrication-brochure.pdf",
    title: "Udhyog Traders - Fabrication Brochure",
    subject: "Sheet metal and structural fabrication",
    pages: [fabricationBrochure],
  },
  {
    file: "udhyog-traders-quality-compliance.pdf",
    title: "Udhyog Traders - Quality & Compliance Summary",
    subject: "Certification, inspection and documentation",
    pages: [qualitySheet],
  },
];

fs.mkdirSync(OUT, { recursive: true });

for (const doc of docs) {
  const pages = doc.pages.map((fn) => fn());
  const { buffer, pages: count } = makePdf(pages, doc);
  const target = path.join(OUT, doc.file);
  fs.writeFileSync(target, buffer);
  console.log(
    `${doc.file}  ${count} page(s)  ${(buffer.length / 1024).toFixed(1)} KB`
  );
}
