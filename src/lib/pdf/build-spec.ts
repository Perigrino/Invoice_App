import type { Spec } from "@json-render/core";
import type { TemplateConfig, TemplateFont, TemplateSpacing } from "../templates/types";
import { mergeTemplateConfig } from "../templates/presets";
import type { PDFData } from "./types";

const PT_PER_MM = 72 / 25.4;
const mm = (n: number) => Math.round(n * PT_PER_MM * 10) / 10;

const FONT_MAP: Record<TemplateFont, string> = {
  courier: "Courier",
  sans: "Helvetica",
  serif: "Times-Roman",
};

const SPACING_FACTOR: Record<TemplateSpacing, number> = {
  compact: 0.88,
  normal: 1,
  relaxed: 1.14,
};

export function mixWhite(hex: string, ratio: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return mixWhite("#00BCD4", ratio);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mr = Math.round(r + (255 - r) * ratio);
  const mg = Math.round(g + (255 - g) * ratio);
  const mb = Math.round(b + (255 - b) * ratio);
  return `#${[mr, mg, mb].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function formatPdfCurrency(amount: number, currency = "GHS"): string {
  const formatted = Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formatted} ${currency}`;
}

function pageSize(paperSize?: string): "A4" | "A3" | "LETTER" | "LEGAL" {
  switch ((paperSize || "A3").toUpperCase()) {
    case "A3":
      return "A3";
    case "LETTER":
      return "LETTER";
    case "LEGAL":
      return "LEGAL";
    default:
      return "A4";
  }
}

type StyleDict = Record<string, unknown>;

interface SpecElement {
  type: string;
  props: Record<string, unknown>;
  children: string[];
}

class SpecBuilder {
  elements: Record<string, SpecElement> = {};
  private n = 0;
  readonly cfg: TemplateConfig;
  readonly font: string;
  readonly fontSize: number;
  readonly spacingFactor: number;

  constructor(cfg: TemplateConfig) {
    this.cfg = cfg;
    this.font = FONT_MAP[cfg.font];
    this.fontSize = cfg.fontSize || 9;
    this.spacingFactor = SPACING_FACTOR[cfg.spacing] || 1;
  }

  el(type: string, props: Record<string, unknown> = {}, children: string[] = []): string {
    const key = `e${this.n++}`;
    this.elements[key] = { type, props, children };
    return key;
  }

  view(style: StyleDict, children: string[] = []): string {
    return this.el("View", { style }, children);
  }

  row(style: StyleDict, children: string[] = []): string {
    return this.el("View", { style: { flexDirection: "row", ...style } }, children);
  }

  col(style: StyleDict, children: string[] = []): string {
    return this.el("View", { style: { flexDirection: "column", ...style } }, children);
  }

  spacer(hMm: number): string {
    return this.el("Spacer", { height: mm(hMm) * this.spacingFactor });
  }

  divider(color: string, thickness = 1, mtMm = 0, mbMm = 0): string {
    return this.el("Divider", {
      color,
      thickness,
      marginTop: mm(mtMm) * this.spacingFactor,
      marginBottom: mm(mbMm) * this.spacingFactor,
    });
  }

  gap(hMm: number): number {
    return mm(hMm) * this.spacingFactor;
  }

  text(
    str: string,
    style: StyleDict = {},
    opts: { bold?: boolean; italic?: boolean; family?: string } = {}
  ): string {
    return this.el("Text", {
      text: str,
      fontFamily: opts.family ?? this.font,
      fontWeight: opts.bold ? "bold" : "normal",
      fontStyle: opts.italic ? "italic" : "normal",
      style: { fontSize: this.fontSize, ...style },
    });
  }

  build(pageChildren: string[], pageProps: Record<string, unknown>): Spec {
    const page = this.el("Page", pageProps, pageChildren);
    const doc = this.el("Document", { title: "Invoice" }, [page]);
    return { root: doc, elements: this.elements };
  }
}

function titleText(cfg: TemplateConfig, invoiceType?: string): string {
  const base = cfg.styles.title || "INVOICE";
  return invoiceType === "proforma" ? "PROFORMA INVOICE" : base;
}

function buildItemsTable(
  b: SpecBuilder,
  data: PDFData,
  opts: {
    headerColor: string;
    headerFill?: string;
    headerBorder?: string;
    headerSize?: number;
    zebra?: string;
    rowBorder?: string;
    textColor: string;
    uppercase?: boolean;
    paddingMm?: number;
  }
): string {
  const comp = b.cfg.components;
  const children: string[] = [];
  const showPrice = comp.priceColumn;
  const showQty = comp.qtyColumn;
  const size = opts.headerSize ?? b.fontSize;
  const pad = mm(opts.paddingMm ?? 2);
  const label = opts.uppercase ? (s: string) => s.toUpperCase() : (s: string) => s;

  const headerCells: string[] = [];
  headerCells.push(b.text(label("Description"), { flex: 1, color: opts.headerColor, fontSize: size }));
  if (showPrice) {
    headerCells.push(b.text(label("Price"), { width: "20%", textAlign: "right", color: opts.headerColor, fontSize: size }));
  }
  if (showQty) {
    headerCells.push(b.text(label("Qty"), { width: "8%", textAlign: "center", color: opts.headerColor, fontSize: size }));
  }
  headerCells.push(b.text(label("Total"), { width: "18%", textAlign: "right", color: opts.headerColor, fontSize: size }));
  children.push(b.view({ flexDirection: "row", backgroundColor: opts.headerFill, padding: pad }, headerCells));
  if (opts.headerBorder) {
    children.push(b.el("Divider", { color: opts.headerBorder, thickness: 1, marginTop: 0, marginBottom: 0 }));
  }

  data.lineItems.forEach((item, idx) => {
    const zebraBg = opts.zebra && idx % 2 === 0 ? opts.zebra : undefined;
    const cells: string[] = [b.text(item.description, { flex: 1, color: opts.textColor })];
    if (showPrice) {
      cells.push(b.text(formatPdfCurrency(item.price, data.currency), { width: "20%", textAlign: "right", color: opts.textColor }));
    }
    if (showQty) {
      cells.push(b.text(String(item.quantity), { width: "8%", textAlign: "center", color: opts.textColor }));
    }
    cells.push(b.text(formatPdfCurrency(item.total, data.currency), { width: "18%", textAlign: "right", color: opts.textColor }));
    children.push(b.view({ flexDirection: "row", backgroundColor: zebraBg, padding: pad }, cells));
    if (opts.rowBorder && idx < data.lineItems.length - 1) {
      children.push(b.el("Divider", { color: opts.rowBorder, thickness: 0.5, marginTop: 0, marginBottom: 0 }));
    }
  });

  return b.col({ marginTop: b.gap(16) }, children);
}

function buildTotals(
  b: SpecBuilder,
  data: PDFData,
  opts: {
    labelColor: string;
    valueColor: string;
    totalColor: string;
    totalFill?: string;
    totalBorderTop?: string;
    totalFontScale?: number;
    boxWidthMm?: number;
    discountColor?: string;
  }
): string {
  const comp = b.cfg.components;
  const rows: string[] = [];
  const rowPad = mm(1.5);
  if (comp.subtotal) {
    rows.push(
      b.row(
        { padding: rowPad },
        [
          b.text("Subtotal", { flex: 1, color: opts.labelColor }),
          b.text(formatPdfCurrency(data.subtotal, data.currency), { color: opts.valueColor }),
        ]
      )
    );
  }
  if (comp.discount && data.discount > 0) {
    rows.push(
      b.row(
        { padding: rowPad },
        [
          b.text("Discount", { flex: 1, color: opts.labelColor }),
          b.text(`-${formatPdfCurrency(data.discount, data.currency)}`, { color: opts.discountColor ?? "#DC2626" }),
        ]
      )
    );
  }
  if (comp.total) {
    if (opts.totalBorderTop) {
      rows.push(b.el("Divider", { color: opts.totalBorderTop, thickness: 0.7, marginTop: mm(3), marginBottom: mm(3) }));
    }
    rows.push(
      b.row(
        { padding: mm(2), backgroundColor: opts.totalFill },
        [
          b.text("Total", { flex: 1, bold: true, color: opts.totalColor, fontSize: b.fontSize * (opts.totalFontScale ?? 1.2) }),
          b.text(formatPdfCurrency(data.total, data.currency), { bold: true, color: opts.totalColor, fontSize: b.fontSize * (opts.totalFontScale ?? 1.2) }),
        ]
      )
    );
  }
  return b.row({ justifyContent: "flex-end", marginTop: b.gap(8) }, [b.col({ width: mm(opts.boxWidthMm ?? 62) }, rows)]);
}

function buildSignature(b: SpecBuilder, color: string): string {
  return b.row(
    { justifyContent: "flex-end", marginTop: b.gap(16) },
    [
      b.view(
        { width: mm(55), alignItems: "center", borderTopWidth: 0.8, borderTopColor: color, paddingTop: mm(3) },
        [b.text("Signature", { fontSize: b.fontSize * 0.9, color, textAlign: "center" })]
      ),
    ]
  );
}

function buildFooter(b: SpecBuilder, data: PDFData, opts: { color: string; centered?: boolean; separator?: string }): string {
  const comp = b.cfg.components;
  if (!comp.footer) return "";
  const sep = opts.separator ?? "   \u2022   ";
  const company = data.companyName || "";
  const left = company ? `${company}${sep}Page {pageNumber} of {totalPages}` : "Page {pageNumber} of {totalPages}";
  return b.el("PageNumber", {
    format: left,
    fontSize: b.fontSize * 0.8,
    color: opts.color,
    align: opts.centered ? "center" : "right",
  });
}

// ── MODERN ──
function buildModern(b: SpecBuilder, data: PDFData): string[] {
  const comp = b.cfg.components;
  const styles = b.cfg.styles;
  const accent = b.cfg.accentColor;
  const secondary = b.cfg.secondaryColor;
  const accentLight = mixWhite(accent, 0.9);
  const secondaryLight = mixWhite(secondary, 0.9);
  const gray = "#6B7280";
  const ink = "#1E293B";
  const children: string[] = [];

  const leftKids: string[] = [];
  const hasLogo = comp.logo && !!data.logo;
  if (hasLogo) {
    leftKids.push(
      b.el("View", { paddingBottom: data.companyAddress ? mm(2) : mm(6) }, [
        b.el("Image", { src: data.logo, width: mm(6.4), height: mm(6.4), objectFit: "contain" }),
      ]),
    );
    if (data.companyAddress) {
      leftKids.push(b.text(data.companyAddress, { fontSize: b.fontSize * 0.9, color: gray, marginTop: mm(1) }));
    }
  }
  if (data.companyName && !hasLogo) {
    leftKids.push(b.text(data.companyName, { fontWeight: "bold", fontSize: b.fontSize * 1.4, color: ink }));
  }
  if (comp.companyContact || !hasLogo) {
    const lines = [data.companyEmail, data.companyPhone].filter(Boolean) as string[];
    if (!hasLogo && data.companyAddress) lines.unshift(data.companyAddress);
    for (const line of lines) {
      leftKids.push(b.text(line, { fontSize: b.fontSize * 0.9, color: gray, marginTop: mm(1) }));
    }
  }
  const leftCol = b.col({ flex: 1, paddingRight: mm(4) }, leftKids);

  const rightKids: string[] = [];
  if (comp.metadata) {
    rightKids.push(b.text(titleText(b.cfg, data.invoiceType), { fontWeight: "bold", fontSize: 28, color: accent, textAlign: "right" }));
    rightKids.push(b.text(data.invoiceNumber, { fontSize: b.fontSize * 1.1, textAlign: "right", marginTop: mm(2) }));
    rightKids.push(b.text(`Issue Date: ${data.issueDate}`, { fontSize: b.fontSize, color: gray, textAlign: "right", marginTop: mm(1) }));
    rightKids.push(b.text(`Due Date: ${data.dueDate}`, { fontSize: b.fontSize, color: gray, textAlign: "right" }));
  }
  const rightCol = b.col({ flex: 1, alignItems: "flex-end" }, rightKids);
  children.push(b.row({ alignItems: "flex-start" }, [leftCol, rightCol]));

  if (comp.clientBlock && data.clientName) {
    const cardKids: string[] = [b.text("Bill To:", { fontSize: b.fontSize, color: gray })];
    cardKids.push(b.text(data.clientName, { fontWeight: "bold", fontSize: b.fontSize * 1.15, marginTop: mm(2) }));
    const details = [
      data.clientEmail && `Email: ${data.clientEmail}`,
      data.clientPhone && `Tel: ${data.clientPhone}`,
      data.clientAddress && `Address: ${data.clientAddress}`,
    ].filter(Boolean) as string[];
    for (const d of details) {
      cardKids.push(b.text(d, { fontSize: b.fontSize * 0.9, color: gray, marginTop: mm(2) }));
    }
    children.push(
      b.view(
        { marginTop: b.gap(14), backgroundColor: "#F8F8F8", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 2, padding: mm(4), width: "55%" },
        cardKids
      )
    );
  }

  children.push(
    buildItemsTable(b, data, {
      headerColor: accent,
      headerFill: styles.tableHeaderFill ? accentLight : undefined,
      headerBorder: accent,
      headerSize: b.fontSize * 0.9,
      zebra: styles.zebraRows ? "#F9FAFB" : undefined,
      textColor: "#000000",
    })
  );

  children.push(
    buildTotals(b, data, {
      labelColor: gray,
      valueColor: "#000000",
      totalColor: secondary,
      totalFill: styles.totalsFill ? secondaryLight : undefined,
      totalBorderTop: secondary,
    })
  );

  if (comp.signature && data.clientName) children.push(buildSignature(b, gray));

  if (comp.notes && data.notes) {
    children.push(
      b.view({ marginTop: b.gap(14), alignItems: "center", borderTopWidth: 1, borderTopColor: accent, paddingTop: mm(5) }, [
        b.text(data.notes, { textAlign: "center", marginTop: mm(3) }),
      ])
    );
  }

  return children;
}

// ── BUSINESS ──
function buildBusiness(b: SpecBuilder, data: PDFData): string[] {
  const comp = b.cfg.components;
  const styles = b.cfg.styles;
  const accent = b.cfg.accentColor;
  const secondary = b.cfg.secondaryColor;
  const accentLight = mixWhite(accent, 0.6);
  const gray = "#4B5563";
  const ink = "#111827";
  const children: string[] = [];

  const leftKids: string[] = [];
  const hasLogo = comp.logo && !!data.logo;
  if (hasLogo) {
    leftKids.push(b.el("Image", { src: data.logo, style: { maxHeight: mm(12), maxWidth: "100%", objectFit: "contain", marginBottom: data.companyAddress ? mm(2) : mm(4) } }));
    if (data.companyAddress) {
      leftKids.push(b.text(data.companyAddress, { fontSize: b.fontSize * 0.85, color: gray, marginTop: mm(1) }));
    }
  }
  if (data.companyName && !hasLogo) {
    leftKids.push(b.text(data.companyName, { fontWeight: "bold", fontSize: b.fontSize * 1.8, color: ink }));
  }
  if (comp.companyContact || !hasLogo) {
    const contact = [data.companyEmail, data.companyPhone].filter(Boolean).join("  |  ");
    const lines = [data.companyAddress, contact].filter(Boolean) as string[];
    if (hasLogo) lines.shift();
    for (const line of lines) {
      leftKids.push(b.text(line, { fontSize: b.fontSize * 0.85, color: gray, marginTop: mm(2) }));
    }
  }
  const leftCol = b.col({ flex: 1, paddingRight: mm(8) }, leftKids);

  const rightKids: string[] = [];
  if (comp.metadata) {
    rightKids.push(b.text(titleText(b.cfg, data.invoiceType), { fontWeight: "bold", fontSize: b.fontSize * 2.1, color: accent, textAlign: "right" }));
    rightKids.push(b.text(data.invoiceNumber, { fontSize: b.fontSize * 1.05, color: gray, textAlign: "right", marginTop: mm(2) }));
    rightKids.push(b.text(`Issued: ${data.issueDate}`, { fontSize: b.fontSize * 0.9, color: gray, textAlign: "right" }));
    rightKids.push(b.text(`Due: ${data.dueDate}`, { fontSize: b.fontSize * 0.9, color: gray, textAlign: "right" }));
  }
  const rightCol = b.col({ alignItems: "flex-end" }, rightKids);
  children.push(b.row({ alignItems: "flex-start", justifyContent: "space-between" }, [leftCol, rightCol]));

  children.push(
    b.view({ marginTop: b.gap(8), borderTopWidth: 1.2, borderTopColor: accent, borderBottomWidth: 0.8, borderBottomColor: accentLight, height: 1.5 })
  );

  const body: string[] = [];
  if (comp.clientBlock && data.clientName) {
    const clientKids: string[] = [
      b.text("BILL TO", { fontSize: b.fontSize * 0.8, color: gray, letterSpacing: 0.8 }),
      b.text(data.clientName, { fontWeight: "bold", fontSize: b.fontSize * 1.15, color: ink, marginTop: mm(3) }),
    ];
    const lines = [
      data.clientAddress,
      data.clientEmail && `Email: ${data.clientEmail}`,
      data.clientPhone && `Tel: ${data.clientPhone}`,
    ].filter(Boolean) as string[];
    for (const line of lines) {
      clientKids.push(b.text(line, { fontSize: b.fontSize * 0.9, color: gray, marginTop: mm(3) }));
    }
    body.push(b.col({ flex: 1 }, clientKids));
  }
  if (comp.metadata) {
    const metaKids: string[] = [b.text("INVOICE DETAILS", { fontSize: b.fontSize * 0.8, color: gray, letterSpacing: 0.8 })];
    const rows: Array<[string, string]> = [
      ["Invoice #", data.invoiceNumber],
      ["Issue Date", data.issueDate],
      ["Due Date", data.dueDate],
    ];
    for (const [k, v] of rows) {
      metaKids.push(
        b.row(
          { marginTop: mm(3) },
          [b.text(k, { flex: 1, fontSize: b.fontSize * 0.9, color: gray }), b.text(v, { fontSize: b.fontSize * 0.9, color: ink })]
        )
      );
    }
    body.push(b.col({ flex: 1 }, metaKids));
  }
  if (body.length) children.push(b.row({ marginTop: b.gap(16) }, body));

  children.push(
    buildItemsTable(b, data, {
      headerColor: accent,
      headerFill: styles.tableHeaderFill ? accentLight : undefined,
      headerBorder: accent,
      headerSize: b.fontSize * 0.8,
      zebra: styles.zebraRows ? "#F9FAFB" : undefined,
      rowBorder: "#E5E7EB",
      textColor: "#000000",
      uppercase: true,
      paddingMm: 2,
    })
  );

  children.push(
    buildTotals(b, data, {
      labelColor: gray,
      valueColor: ink,
      totalColor: secondary,
      totalBorderTop: secondary,
      totalFontScale: 1.2,
      boxWidthMm: 62,
    })
  );

  if (comp.signature && data.clientName) children.push(buildSignature(b, gray));

  if (comp.notes && data.notes) {
    children.push(
      b.view({ marginTop: b.gap(12) }, [
        b.text(data.notes, { fontSize: b.fontSize, color: "#1F2937", textAlign: "center" }),
      ])
    );
  }

  return children;
}

// ── MINIMAL ──
function buildMinimal(b: SpecBuilder, data: PDFData): string[] {
  const comp = b.cfg.components;
  const styles = b.cfg.styles;
  const accent = b.cfg.accentColor;
  const ink = "#334155";
  const gray = "#94A3B8";
  const children: string[] = [];

  const hasLogo = comp.logo && !!data.logo;
  if (hasLogo) {
    children.push(b.el("Image", { src: data.logo, style: { maxHeight: mm(11), maxWidth: "100%", objectFit: "contain", alignSelf: "flex-start" } }));
    if (data.companyAddress) {
      children.push(b.text(data.companyAddress, { fontSize: b.fontSize * 0.9, color: gray, marginTop: mm(2) }));
    }
  }
  if (data.companyName && !hasLogo) {
    children.push(b.text(data.companyName, { fontWeight: "bold", fontSize: b.fontSize * 1.7, color: ink }));
  }
  if (comp.companyContact || !hasLogo) {
    const lines = [data.companyEmail, data.companyPhone].filter(Boolean) as string[];
    if (!hasLogo && data.companyAddress) lines.unshift(data.companyAddress);
    for (const line of lines) {
      children.push(b.text(line, { fontSize: b.fontSize * 0.9, color: gray, marginTop: mm(2) }));
    }
  }

  if (comp.metadata) {
    const spacedTitle = titleText(b.cfg, data.invoiceType).split("").join(" ");
    children.push(
      b.view({ marginTop: b.gap(16) }, [
        b.text(spacedTitle, { fontSize: b.fontSize, color: accent, letterSpacing: 1 }),
        b.el("Divider", { color: "#E2E8F0", thickness: 0.4, marginTop: mm(5), marginBottom: 0 }),
      ])
    );
    children.push(
      b.view({ marginTop: b.gap(8) }, [
        b.row({}, [b.text(data.invoiceNumber, { flex: 1, fontSize: b.fontSize * 0.9, color: gray }), b.text("", { fontSize: b.fontSize * 0.9 })]),
        b.row({ marginTop: mm(2) }, [b.text("Issue Date", { flex: 1, fontSize: b.fontSize * 0.9, color: gray }), b.text(data.issueDate, { fontSize: b.fontSize * 0.9, color: ink })]),
        b.row({ marginTop: mm(2) }, [b.text("Due Date", { flex: 1, fontSize: b.fontSize * 0.9, color: gray }), b.text(data.dueDate, { fontSize: b.fontSize * 0.9, color: ink })]),
      ])
    );
    children.push(b.text("BILL TO", { fontSize: b.fontSize * 0.8, color: gray, marginTop: b.gap(10) }));
  }

  if (comp.clientBlock && data.clientName) {
    const clientKids: string[] = [b.text(data.clientName, { fontWeight: "bold", fontSize: b.fontSize * 1.1, marginTop: mm(2) })];
    const lines = [
      data.clientAddress,
      data.clientEmail && `Email: ${data.clientEmail}`,
      data.clientPhone && `Tel: ${data.clientPhone}`,
    ].filter(Boolean) as string[];
    for (const line of lines) {
      clientKids.push(b.text(line, { fontSize: b.fontSize * 0.9, color: gray, marginTop: mm(2) }));
    }
    children.push(b.col({}, clientKids));
  }

  children.push(
    buildItemsTable(b, data, {
      headerColor: gray,
      headerFill: styles.tableHeaderFill ? "#F8FAFC" : undefined,
      headerBorder: "#CBD5E1",
      headerSize: b.fontSize * 0.8,
      zebra: styles.zebraRows ? "#F8FAFC" : undefined,
      textColor: ink,
      uppercase: true,
      paddingMm: 2.5,
    })
  );

  children.push(
    buildTotals(b, data, {
      labelColor: gray,
      valueColor: ink,
      totalColor: ink,
      totalBorderTop: "#94A3B8",
      totalFontScale: 1.1,
      boxWidthMm: 62,
    })
  );

  if (comp.signature && data.clientName) children.push(buildSignature(b, gray));

  if (comp.notes && data.notes) {
    children.push(
      b.view({ marginTop: b.gap(12) }, [
        b.el("Divider", { color: "#E2E8F0", thickness: 0.4, marginTop: 0, marginBottom: mm(6) }),
        b.text(data.notes, { fontSize: b.fontSize, color: ink, marginTop: mm(2), textAlign: "center" }),
      ])
    );
  }

  return children;
}

// ── PROFESSIONAL ──
function buildProfessional(b: SpecBuilder, data: PDFData): string[] {
  const comp = b.cfg.components;
  const styles = b.cfg.styles;
  const accent = b.cfg.accentColor;
  const secondary = b.cfg.secondaryColor;
  const accentLight = mixWhite(accent, 0.93);
  const gray = "#4B5563";
  const ink = "#111827";
  const children: string[] = [];
  const mainLeft = 20 + 38 + 10;

  const sideKids: string[] = [];
  const hasLogo = comp.logo && !!data.logo;
  if (hasLogo) {
    sideKids.push(b.el("Image", { src: data.logo, style: { maxWidth: "100%", maxHeight: mm(14), objectFit: "contain", marginBottom: data.companyAddress ? mm(2) : mm(6) } }));
    if (data.companyAddress) {
      sideKids.push(b.text(data.companyAddress, { fontSize: b.fontSize * 0.78, color: "#E6EEFF", marginTop: mm(4) }));
    }
  }
  if (data.companyName && !hasLogo) {
    sideKids.push(b.text(data.companyName, { fontWeight: "bold", fontSize: b.fontSize * 1.25, color: "#FFFFFF", lineHeight: 1.15 }));
  }
  if (comp.companyContact || !hasLogo) {
    const lines = [data.companyEmail, data.companyPhone].filter(Boolean) as string[];
    if (!hasLogo && data.companyAddress) lines.unshift(data.companyAddress);
    for (const line of lines) {
      sideKids.push(b.text(line, { fontSize: b.fontSize * 0.78, color: "#E6EEFF", marginTop: mm(4) }));
    }
  }
  const sidebar = b.view(
    { position: "absolute", top: mm(14), bottom: mm(14), left: mm(20), width: mm(38), backgroundColor: accent, padding: mm(4) },
    sideKids
  );

  const mainKids: string[] = [];
  if (comp.metadata) {
    mainKids.push(
      b.view({ alignItems: "flex-end", marginTop: mm(6) }, [
        b.text(titleText(b.cfg, data.invoiceType), { fontWeight: "bold", fontSize: b.fontSize * 2.3, color: accent }),
        b.text(data.invoiceNumber, { fontSize: b.fontSize * 1.05, color: ink, marginTop: mm(2) }),
        b.text(`Issue Date: ${data.issueDate}`, { fontSize: b.fontSize * 0.9, color: gray, marginTop: mm(2) }),
        b.text(`Due Date: ${data.dueDate}`, { fontSize: b.fontSize * 0.9, color: gray }),
      ])
    );
  }

  if (comp.clientBlock && data.clientName) {
    const clientKids: string[] = [
      b.text("BILL TO", { fontSize: b.fontSize * 0.8, color: gray, letterSpacing: 0.8 }),
      b.text(data.clientName, { fontWeight: "bold", fontSize: b.fontSize * 1.2, color: ink, marginTop: mm(2) }),
    ];
    const lines = [
      data.clientAddress,
      data.clientEmail && `Email: ${data.clientEmail}`,
      data.clientPhone && `Tel: ${data.clientPhone}`,
    ].filter(Boolean) as string[];
    for (const line of lines) {
      clientKids.push(b.text(line, { fontSize: b.fontSize * 0.9, color: gray, marginTop: mm(3) }));
    }
    mainKids.push(b.col({ marginTop: b.gap(14) }, clientKids));
  }

  mainKids.push(
    buildItemsTable(b, data, {
      headerColor: accent,
      headerFill: styles.tableHeaderFill ? accentLight : undefined,
      headerBorder: accent,
      headerSize: b.fontSize * 0.85,
      zebra: styles.zebraRows ? "#F5F6FC" : undefined,
      textColor: "#000000",
    })
  );

  if (comp.subtotal || comp.discount || comp.total) {
    const totalRows: string[] = [];
    if (comp.subtotal) {
      totalRows.push(b.row({ padding: mm(1.5) }, [b.text("Subtotal", { flex: 1, fontSize: b.fontSize, color: gray }), b.text(formatPdfCurrency(data.subtotal, data.currency), { fontSize: b.fontSize, color: ink })]));
    }
    if (comp.discount && data.discount > 0) {
      totalRows.push(b.row({ padding: mm(1.5) }, [b.text("Discount", { flex: 1, fontSize: b.fontSize, color: gray }), b.text(`-${formatPdfCurrency(data.discount, data.currency)}`, { fontSize: b.fontSize, color: "#DC2626" })]));
    }
    if (comp.total) {
      totalRows.push(
        b.view({ borderTopWidth: 0.8, borderTopColor: secondary, marginTop: mm(4), paddingTop: mm(4) }, [
          b.row({}, [b.text("Total", { flex: 1, bold: true, fontSize: b.fontSize * 1.2, color: secondary }), b.text(formatPdfCurrency(data.total, data.currency), { bold: true, fontSize: b.fontSize * 1.2, color: secondary })]),
        ])
      );
    }
    mainKids.push(
      b.row({ justifyContent: "flex-end", marginTop: b.gap(10) }, [
        b.view({ width: mm(66), backgroundColor: "#F8F9FE", borderLeftWidth: 2.2, borderLeftColor: accent, padding: mm(6) }, totalRows),
      ])
    );
  }

  if (comp.signature && data.clientName) mainKids.push(buildSignature(b, gray));

  if (comp.notes && data.notes) {
    mainKids.push(
      b.view({ marginTop: b.gap(12) }, [
        b.text(data.notes, { fontSize: b.fontSize, color: "#1F2937", marginTop: mm(2), textAlign: "center" }),
      ])
    );
  }

  const footer = buildFooter(b, data, { color: accent });
  if (footer) mainKids.push(footer);

  const main = b.view({ marginLeft: mm(mainLeft), paddingRight: mm(20), flex: 1 }, mainKids);
  children.push(sidebar, main);
  return children;
}

// ── ELEGANT ──
function buildElegant(b: SpecBuilder, data: PDFData): string[] {
  const comp = b.cfg.components;
  const styles = b.cfg.styles;
  const accent = b.cfg.accentColor;
  const secondary = b.cfg.secondaryColor;
  const ink = "#1E1B14";
  const gray = "#6B7280";
  const children: string[] = [];

  const centerKids: string[] = [];
  const hasLogo = comp.logo && !!data.logo;
  if (hasLogo) {
    centerKids.push(b.el("Image", { src: data.logo, style: { maxHeight: mm(12), maxWidth: "60%", objectFit: "contain", alignSelf: "center" } }));
    if (data.companyAddress) {
      centerKids.push(b.text(data.companyAddress, { fontSize: b.fontSize * 0.85, color: gray, textAlign: "center", marginTop: mm(2) }));
    }
  }
  if (data.companyName && !hasLogo) {
    centerKids.push(b.text(data.companyName, { fontWeight: "bold", fontSize: b.fontSize * 1.6, color: ink, textAlign: "center" }));
  }
  if (comp.companyContact || !hasLogo) {
    const lines = [data.companyEmail, data.companyPhone].filter(Boolean) as string[];
    if (!hasLogo && data.companyAddress) lines.unshift(data.companyAddress);
    for (const line of lines) {
      centerKids.push(b.text(line, { fontSize: b.fontSize * 0.85, color: gray, textAlign: "center", marginTop: mm(2) }));
    }
  }
  children.push(b.col({ alignItems: "center" }, centerKids));

  if (comp.metadata) {
    children.push(
      b.row({ justifyContent: "center", alignItems: "center", marginTop: b.gap(8) }, [
        b.view({ width: mm(26), borderTopWidth: 0.4, borderTopColor: accent }),
        b.view({ width: mm(8), height: 1 }),
        b.view({ width: mm(26), borderTopWidth: 0.4, borderTopColor: accent }),
      ])
    );
    children.push(b.text(titleText(b.cfg, data.invoiceType).toUpperCase(), { fontWeight: "bold", fontSize: b.fontSize * 1.9, color: accent, textAlign: "center", marginTop: mm(7) }));
    children.push(
      b.row({ justifyContent: "center", alignItems: "center", marginTop: mm(6) }, [
        b.view({ width: mm(26), borderTopWidth: 0.4, borderTopColor: accent }),
        b.view({ width: mm(8), height: 1 }),
        b.view({ width: mm(26), borderTopWidth: 0.4, borderTopColor: accent }),
      ])
    );
    children.push(
      b.text(
        [`No. ${data.invoiceNumber}`, `Issued ${data.issueDate}`, `Due ${data.dueDate}`].join("      \u2022      "),
        { fontSize: b.fontSize * 0.9, color: gray, textAlign: "center", marginTop: b.gap(8) }
      )
    );
  }

  if (comp.clientBlock && data.clientName) {
    const clientKids: string[] = [
      b.text("BILL TO", { fontSize: b.fontSize * 0.8, color: gray, textAlign: "center", letterSpacing: 0.8 }),
      b.text(data.clientName, { fontWeight: "bold", fontSize: b.fontSize * 1.1, color: ink, textAlign: "center", marginTop: mm(3) }),
    ];
    const lines = [
      data.clientAddress,
      data.clientEmail && `Email: ${data.clientEmail}`,
      data.clientPhone && `Tel: ${data.clientPhone}`,
    ].filter(Boolean) as string[];
    for (const line of lines) {
      clientKids.push(b.text(line, { fontSize: b.fontSize * 0.9, color: gray, textAlign: "center", marginTop: mm(3) }));
    }
    children.push(b.col({ alignItems: "center", marginTop: b.gap(12) }, clientKids));
  }

  children.push(
    buildItemsTable(b, data, {
      headerColor: accent,
      headerFill: styles.tableHeaderFill ? mixWhite(accent, 0.95) : undefined,
      headerBorder: accent,
      headerSize: b.fontSize * 0.85,
      rowBorder: "#E1DACD",
      textColor: ink,
    })
  );

  if (comp.subtotal || comp.discount || comp.total) {
    const totalRows: string[] = [];
    if (comp.subtotal) {
      totalRows.push(b.row({ padding: mm(1.5) }, [b.text("Subtotal", { flex: 1, fontSize: b.fontSize, color: gray }), b.text(formatPdfCurrency(data.subtotal, data.currency), { fontSize: b.fontSize, color: ink })]));
    }
    if (comp.discount && data.discount > 0) {
      totalRows.push(b.row({ padding: mm(1.5) }, [b.text("Discount", { flex: 1, fontSize: b.fontSize, color: gray }), b.text(`-${formatPdfCurrency(data.discount, data.currency)}`, { fontSize: b.fontSize, color: "#B22222" })]));
    }
    if (comp.total) {
      totalRows.push(
        b.view({ borderTopWidth: 0.3, borderTopColor: accent, marginTop: mm(3), paddingTop: mm(3) }, [
          b.row({}, [b.text("Total", { flex: 1, bold: true, fontSize: b.fontSize * 1.2, color: secondary }), b.text(formatPdfCurrency(data.total, data.currency), { bold: true, fontSize: b.fontSize * 1.2, color: secondary })]),
        ])
      );
    }
    children.push(
      b.row({ justifyContent: "flex-end", marginTop: b.gap(8) }, [
        b.view(
          { width: mm(64), borderWidth: 0.4, borderColor: accent, padding: mm(4) },
          [
            b.view({ width: "100%", borderWidth: 0.15, borderColor: secondary, padding: mm(2) }, totalRows),
          ]
        ),
      ])
    );
  }

  if (comp.signature && data.clientName) children.push(buildSignature(b, gray));

  if (comp.notes && data.notes) {
    children.push(
      b.view({ marginTop: b.gap(16), alignItems: "center" }, [
        b.view({ width: mm(48), borderTopWidth: 0.4, borderTopColor: accent, marginBottom: mm(6) }),
        b.text(data.notes, { fontSize: b.fontSize, color: ink, textAlign: "center", marginTop: mm(3) }),
      ])
    );
  }

  return children;
}

const TEMPLATE_BUILDERS: Record<string, (b: SpecBuilder, data: PDFData) => string[]> = {
  modern: buildModern,
  business: buildBusiness,
  minimal: buildMinimal,
  professional: buildProfessional,
  elegant: buildElegant,
};

export function buildInvoiceSpec(data: PDFData): Spec {
  const cfg = mergeTemplateConfig(data.templateConfig, data.templateConfig?.base || "modern");
  const fullData: PDFData = { ...data, templateConfig: cfg };
  const b = new SpecBuilder(cfg);
  const builder = TEMPLATE_BUILDERS[cfg.base] || TEMPLATE_BUILDERS.modern;

  const pageChildren: string[] = [];
  if (cfg.base === "professional") {
    pageChildren.push(...builder(b, fullData));
  } else {
    const contentKids = builder(b, fullData);
    pageChildren.push(b.col({ flex: 1 }, contentKids));
    const footer = buildFooter(b, fullData, {
      color: cfg.base === "elegant" ? cfg.accentColor : "#6B7280",
      centered: cfg.base === "elegant",
    });
    if (footer) pageChildren.push(footer);
  }

  return b.build(pageChildren, {
    size: pageSize(data.paperSize),
    marginTop: mm(20),
    marginBottom: mm(20),
    marginLeft: mm(20),
    marginRight: mm(20),
  });
}
