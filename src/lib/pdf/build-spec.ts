import type { Spec } from "@json-render/core";
import type {
  TemplateConfig,
  TemplateFont,
  TemplateLogoSize,
  TemplateSpacing,
} from "../templates/types";
import { mergeTemplateConfig } from "../templates/presets";
import type { PDFData, PdfNumberFormat } from "./types";
import { pdfLabels, type PdfLabels } from "./labels";

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

const LOGO_HEIGHT_MM: Record<TemplateLogoSize, number> = {
  small: 14,
  medium: 22,
  large: 32,
};

/**
 * Layout numbers shared by the renderers and the pagination estimates. Keeping
 * one copy is what stops a row from rendering taller than it was measured.
 */
const ROW_PAD_Y_MM = 2.5;
const HEADER_PAD_Y_MM = 2;
const CELL_PAD_X_MM = 4.2;
const COLUMN_GUTTER_MM = 2;
const LINE_FACTOR = 1.28;

const GROUP_SEPARATOR: Record<PdfNumberFormat["separator"], string> = {
  comma: ",",
  dot: ".",
  space: " ",
};

function formatPdfAmount(
  amount: number,
  format?: PdfNumberFormat,
  language?: string
): string {
  const decimals = Math.min(Math.max(format?.decimalPlaces ?? 2, 0), 4);
  const fixed = Math.abs(amount).toFixed(decimals);
  const [whole, fraction] = fixed.split(".");
  const group = GROUP_SEPARATOR[format?.separator ?? "comma"];
  // The thousands separator can never double as the decimal mark, and a space
  // leaves it to the document's language: 1 234,56 in French, 1 234.56 in English.
  const commaDecimal = group === "." || (group === " " && (language || "en").toLowerCase() !== "en");
  const decimalMark = group === "," ? "." : commaDecimal ? "," : ".";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return fraction ? `${grouped}${decimalMark}${fraction}` : grouped;
}

function formatPdfCurrency(
  amount: number,
  currency = "GHS",
  format?: PdfNumberFormat,
  language?: string
): string {
  const value = formatPdfAmount(amount, format, language);
  return format?.signPlacement === "before" ? `${currency} ${value}` : `${value} ${currency}`;
}

type PageName = "A4" | "A3" | "LETTER" | "LEGAL";

function pageSize(paperSize?: string): PageName {
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

/** Widest page dimension in points, matching the sizes react-pdf renders. */
const PAGE_WIDTH_PT: Record<PageName, number> = {
  A4: 595.28,
  A3: 841.89,
  LETTER: 612,
  LEGAL: 612,
};

/** Tallest page dimension in points. */
const PAGE_HEIGHT_PT: Record<PageName, number> = {
  A4: 841.89,
  A3: 1190.55,
  LETTER: 792,
  LEGAL: 1008,
};

const MARGIN_PT = mm(13);

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
  /** Width between the page margins, so columns can size against the page. */
  readonly contentWidth: number;

  constructor(cfg: TemplateConfig, contentWidth: number) {
    this.cfg = cfg;
    this.font = FONT_MAP[cfg.font];
    this.fontSize = cfg.fontSize || 12;
    this.spacingFactor = SPACING_FACTOR[cfg.spacing] || 1;
    this.contentWidth = contentWidth;
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

  page(children: string[], props: Record<string, unknown>): string {
    return this.el("Page", props, children);
  }

  build(pageKeys: string[], documentProps: Record<string, unknown>): Spec {
    const doc = this.el("Document", documentProps, pageKeys);
    return { root: doc, elements: this.elements };
  }
}

function buildSignature(b: SpecBuilder, label: string, color: string): string {
  return b.row(
    { justifyContent: "flex-end", marginTop: b.gap(10) },
    [
      b.view(
        { width: mm(55), alignItems: "center", borderTopWidth: 0.8, borderTopColor: color, paddingTop: mm(3) },
        [b.text(label, { fontSize: b.fontSize * 0.9, color, textAlign: "center" })]
      ),
    ]
  );
}

// ── DARK & LIGHT: the Mac app's two PDF templates ──
//
// Both share one layout — bracketed title, accent rules, monospace text,
// dashed row separators, right-aligned totals — and differ only in palette,
// exactly like DarkTheme and LightTheme in the Mac app's PDFGenerator.swift.
// The Mac app rasterises a SwiftUI view; here the same design is drawn as
// vector text so it stays selectable and small.

interface PdfTheme {
  bg: string;
  text: string;
  bold: string;
  border: string;
}

const PDF_THEMES: Record<"dark" | "light", PdfTheme> = {
  dark: { bg: "#0D0D14", text: "#999999", bold: "#DEDEDE", border: "#212121" },
  light: { bg: "#FAFAFA", text: "#545454", bold: "#121212", border: "#D1D1D1" },
};

function rgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Flattens an alpha colour onto the page, the way SwiftUI's .opacity does. */
function blend(bg: string, fg: string, alpha: number): string {
  const from = rgb(bg);
  const to = rgb(fg);
  return `#${[0, 1, 2]
    .map((i) => Math.round(from[i] + (to[i] - from[i]) * alpha).toString(16).padStart(2, "0"))
    .join("")}`;
}

interface Ctx {
  b: SpecBuilder;
  data: PDFData;
  cfg: TemplateConfig;
  theme: PdfTheme;
  labels: PdfLabels;
  sz: number;
  accent: string;
  muted: string;
  faint: string;
  typeName: string;
  moneyWidth: number;
  totalsWidth: number;
  descWidth: number;
  nums?: PdfNumberFormat;
}

function money(ctx: Ctx, amount: number): string {
  return formatPdfCurrency(amount, ctx.data.currency, ctx.nums, ctx.data.language);
}

function bracketLabel(b: SpecBuilder, label: string, theme: PdfTheme, accent: string): string {
  return b.row({}, [
    b.text("[ ", { color: accent, fontSize: b.fontSize }),
    b.text(label, { color: theme.bold, fontSize: b.fontSize }),
    b.text(" ]", { color: accent, fontSize: b.fontSize }),
  ]);
}

function refRow(b: SpecBuilder, label: string, value: string, theme: PdfTheme): string {
  return b.row({ justifyContent: "flex-end", marginBottom: mm(1) }, [
    b.text(`${label}  `, { color: blend(theme.bg, theme.text, 0.7), fontSize: b.fontSize }),
    b.text(value, { color: theme.bold, fontSize: b.fontSize }),
  ]);
}

function dashedRule(b: SpecBuilder, color: string, mtMm = 1, mbMm = 1): string {
  return b.view({
    borderBottomWidth: 0.8,
    borderBottomColor: color,
    borderStyle: "dashed",
    marginTop: mm(mtMm),
    marginBottom: mm(mbMm),
  });
}

function accentRule(b: SpecBuilder, theme: PdfTheme, accent: string): string {
  return b.view({
    borderBottomWidth: 1,
    borderBottomColor: blend(theme.bg, accent, 0.4),
    marginTop: mm(6),
    marginBottom: mm(6),
  });
}

function documentHeader(ctx: Ctx): string[] {
  const { b, data, cfg, theme, labels, accent, sz } = ctx;
  const comp = cfg.components;
  const kids: string[] = [];

  // [ Invoice — 2,240.00 GHS ]
  kids.push(
    b.row({ justifyContent: "center", marginTop: mm(2), marginBottom: mm(6) }, [
      b.text("[ ", { color: accent, fontSize: sz + 1 }),
      b.text(`${ctx.typeName} \u2014 ${money(ctx, data.total)}`, { color: theme.bold, fontSize: sz + 1 }),
      b.text(" ]", { color: accent, fontSize: sz + 1 }),
    ])
  );

  // Logo (left) and the reference rows (right).
  const headKids: string[] = [];
  if (comp.logo && data.logo) {
    // The standard Image only reads width/height/objectFit props; a style box is
    // ignored and the image falls back to its intrinsic size.
    headKids.push(
      b.el("Image", {
        src: data.logo,
        height: mm(LOGO_HEIGHT_MM[cfg.styles.logoSize]),
        width: Math.min(mm(90), b.contentWidth * 0.45),
        objectFit: "contain",
      })
    );
  } else if (comp.companyName && data.companyName) {
    headKids.push(b.text(data.companyName, { bold: true, fontSize: sz + 4, color: theme.bold }));
  }

  const refKids: string[] = [];
  if (comp.metadata) {
    refKids.push(refRow(b, labels.ref, data.invoiceNumber, theme));
    refKids.push(refRow(b, labels.issued, data.issueDate, theme));
    if (data.dueDate && data.dueDate !== "\u2014") {
      refKids.push(refRow(b, labels.due, data.dueDate, theme));
    }
  }
  kids.push(
    b.row({ alignItems: "flex-start" }, [
      b.col({ flex: 1 }, headKids),
      b.col({ alignItems: "flex-end" }, refKids),
    ])
  );

  kids.push(accentRule(b, theme, accent));

  // From / Bill to.
  const fromKids: string[] = [bracketLabel(b, labels.from, theme, accent)];
  if (comp.companyName && data.companyName) {
    fromKids.push(b.text(data.companyName, { bold: true, fontSize: sz + 2, color: theme.bold, marginTop: mm(1.5) }));
  }
  if (comp.companyContact) {
    for (const line of String(data.companyAddress || "").split("\n").filter(Boolean)) {
      fromKids.push(b.text(line, { color: ctx.muted, fontSize: sz }));
    }
    if (data.companyEmail) fromKids.push(b.text(data.companyEmail, { color: ctx.faint, fontSize: sz }));
    if (data.companyPhone) fromKids.push(b.text(data.companyPhone, { color: ctx.faint, fontSize: sz }));
  }

  const toKids: string[] = [bracketLabel(b, labels.billTo, theme, accent)];
  if (comp.clientBlock && data.clientName) {
    toKids.push(b.text(data.clientName, { bold: true, fontSize: sz + 2, color: theme.bold, marginTop: mm(1.5) }));
    for (const line of String(data.clientAddress || "").split("\n").filter(Boolean)) {
      toKids.push(b.text(line, { color: ctx.muted, fontSize: sz }));
    }
    if (data.clientEmail) toKids.push(b.text(data.clientEmail, { color: ctx.faint, fontSize: sz }));
    if (data.clientPhone) toKids.push(b.text(data.clientPhone, { color: ctx.faint, fontSize: sz }));
  }
  kids.push(
    b.row({ alignItems: "flex-start", marginTop: mm(2) }, [
      b.col({ flex: 1 }, fromKids),
      b.col({ flex: 1 }, toKids),
    ])
  );

  kids.push(accentRule(b, theme, accent));
  return kids;
}

function continuationHeader(ctx: Ctx): string[] {
  const { b, data, theme, labels, sz } = ctx;
  return [
    b.row({ justifyContent: "space-between", marginBottom: mm(4) }, [
      b.text(`${data.companyName || ctx.typeName} \u2022 ${data.invoiceNumber}`, {
        color: blend(theme.bg, theme.text, 0.75),
        fontSize: sz * 0.85,
      }),
      b.text(labels.continued, { color: blend(theme.bg, theme.text, 0.75), fontSize: sz * 0.85 }),
    ]),
  ];
}

function tableHeaderRow(ctx: Ctx): string {
  const { b, cfg, theme, labels, sz } = ctx;
  const comp = cfg.components;
  const fill = cfg.styles.tableHeaderFill
    ? blend(theme.bg, cfg.secondaryColor, 0.2)
    : blend(theme.bg, theme.text, 0.06);
  const gutter = { paddingLeft: mm(COLUMN_GUTTER_MM) * b.spacingFactor };
  const cells = [
    b.text(labels.description, { flex: 1, color: theme.bold, fontSize: sz }),
    ...(comp.qtyColumn
      ? [b.text(labels.qty, { width: 46, textAlign: "right", color: theme.bold, fontSize: sz, ...gutter })]
      : []),
    ...(comp.priceColumn
      ? [b.text(labels.unitPrice, { width: ctx.moneyWidth, textAlign: "right", color: theme.bold, fontSize: sz, ...gutter })]
      : []),
    b.text(labels.amount, { width: ctx.moneyWidth, textAlign: "right", color: theme.bold, fontSize: sz, ...gutter }),
  ];
  return b.row(
    {
      backgroundColor: fill,
      paddingVertical: mm(HEADER_PAD_Y_MM) * b.spacingFactor,
      // Same horizontal inset as the item rows so the columns line up.
      paddingHorizontal: mm(CELL_PAD_X_MM) * b.spacingFactor,
    },
    cells
  );
}

function itemRow(ctx: Ctx, index: number): string {
  const { b, cfg, theme, data, sz } = ctx;
  const item = data.lineItems[index];
  const comp = cfg.components;
  const background = cfg.styles.zebraRows && index % 2 === 1 ? blend(theme.bg, theme.text, 0.04) : undefined;
  const gutter = { paddingLeft: mm(COLUMN_GUTTER_MM) * b.spacingFactor };
  const cells = [
    b.text(item.description || "\u2014", { flex: 1, color: theme.bold, fontSize: sz }),
    ...(comp.qtyColumn
      ? [b.text(String(item.quantity), { width: 46, textAlign: "right", color: theme.bold, fontSize: sz, ...gutter })]
      : []),
    ...(comp.priceColumn
      ? [b.text(money(ctx, item.price), { width: ctx.moneyWidth, textAlign: "right", color: theme.bold, fontSize: sz, ...gutter })]
      : []),
    b.text(money(ctx, item.total), { width: ctx.moneyWidth, textAlign: "right", color: theme.bold, fontSize: sz, ...gutter }),
  ];
  return b.row(
    {
      paddingVertical: mm(ROW_PAD_Y_MM) * b.spacingFactor,
      paddingHorizontal: mm(CELL_PAD_X_MM) * b.spacingFactor,
      ...(background ? { backgroundColor: background } : {}),
    },
    cells
  );
}

function totalsBlock(ctx: Ctx): string {
  const { b, cfg, data, theme, labels, sz, accent } = ctx;
  const comp = cfg.components;
  const rows: string[] = [];
  if (comp.subtotal) {
    rows.push(
      b.row({}, [
        b.text(labels.subtotal, { flex: 1, color: ctx.muted, fontSize: sz }),
        b.text(money(ctx, data.subtotal), { color: theme.bold, fontSize: sz }),
      ])
    );
  }
  if (comp.discount && data.discountAmount > 0) {
    rows.push(
      b.row({}, [
        b.text(labels.discount, { flex: 1, color: ctx.muted, fontSize: sz }),
        b.text(`-${money(ctx, data.discountAmount)}`, { color: "#DC2626", fontSize: sz }),
      ])
    );
  }
  if (data.taxAmount > 0) {
    rows.push(
      b.row({}, [
        b.text(labels.tax, { flex: 1, color: ctx.muted, fontSize: sz }),
        b.text(money(ctx, data.taxAmount), { color: theme.bold, fontSize: sz }),
      ])
    );
  }
  if (comp.total) {
    rows.push(b.view({ borderBottomWidth: 0.8, borderBottomColor: theme.border, marginTop: mm(2), marginBottom: mm(2) }));
    rows.push(
      b.row({}, [
        b.text(labels.total, { color: accent, fontSize: sz + 1 }, { bold: true }),
        b.text(money(ctx, data.total), { color: accent, fontSize: sz + 2, flex: 1, textAlign: "right" }, { bold: true }),
      ])
    );
  }
  const column = b.col({ width: ctx.totalsWidth }, rows);
  const body = cfg.styles.totalsFill
    ? b.view(
        {
          backgroundColor: blend(theme.bg, cfg.secondaryColor, 0.1),
          padding: mm(3),
          borderRadius: 2,
        },
        [column]
      )
    : column;
  return b.row({ justifyContent: "flex-end", marginTop: mm(4) }, [body]);
}

function notesBlock(ctx: Ctx): string {
  const { b, data, theme, labels, sz } = ctx;
  const note = data.notes && data.notes.trim() ? data.notes : labels.thankYou;
  return b.row(
    { justifyContent: "center", marginTop: mm(8), marginBottom: mm(4) },
    [
      b.text(note, {
        color: data.notes ? ctx.muted : blend(theme.bg, theme.text, 0.45),
        fontSize: sz - 0.5,
        width: b.contentWidth,
        textAlign: "center",
      }),
    ]
  );
}

function footerFor(ctx: Ctx, centered: boolean): string {
  const { b, data, labels, sz } = ctx;
  const company = data.companyName || "";
  const prefix = company ? `${company}   \u2022   ` : "";
  return b.el("PageNumber", {
    format: `${prefix}${labels.page}`,
    fontSize: sz * 0.85,
    color: ctx.muted,
    align: centered ? "center" : "right",
  });
}

/** Estimated height of wrapped text, with slack for the PDF's own leading. */
function estimateLines(value: string, widthPt: number, fontSize: number): number {
  const charsPerLine = Math.max(6, Math.floor(widthPt / (fontSize * 0.62)));
  return String(value)
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

interface PageMetrics {
  usableHeight: number;
  headerHeight: number;
  continuationHeight: number;
  tableHeaderHeight: number;
  extrasHeight: number;
  rowHeight: (index: number) => number;
}

function metricsFor(ctx: Ctx, height: number, hasFooter: boolean): PageMetrics {
  const { b, cfg, data, sz, descWidth } = ctx;
  const spacing = b.spacingFactor;
  // Leading is estimated slightly above the renderer's 1.2em so a row is never
  // split by the PDF's own page break, which would defeat the explicit pages.
  const line = sz * LINE_FACTOR;

  const titleHeight = mm(2) + (sz + 1) * 1.35 + mm(6);
  const logoMm = LOGO_HEIGHT_MM[cfg.styles.logoSize];
  const brandHeight = cfg.components.logo && data.logo ? mm(logoMm) : cfg.components.companyName && data.companyName ? (sz + 4) * 1.35 : 0;
  const refCount = cfg.components.metadata ? (data.dueDate && data.dueDate !== "\u2014" ? 3 : 2) : 0;
  const refHeight = refCount * (line + mm(1));
  const brandRow = Math.max(brandHeight, refHeight) + mm(12);

  const companyLines =
    (cfg.components.companyName && data.companyName ? 1 : 0) +
    (cfg.components.companyContact
      ? String(data.companyAddress || "").split("\n").filter(Boolean).length +
        (data.companyEmail ? 1 : 0) +
        (data.companyPhone ? 1 : 0)
      : 0);
  const clientLines = cfg.components.clientBlock && data.clientName
    ? 1 +
      String(data.clientAddress || "").split("\n").filter(Boolean).length +
      (data.clientEmail ? 1 : 0) +
      (data.clientPhone ? 1 : 0)
    : 0;
  const fromToHeight = mm(2) + Math.max(1, companyLines, clientLines) * line + mm(12);

  const footerHeight = hasFooter ? sz * 0.8 * 1.35 + mm(8) : 0;
  const usableHeight = height - MARGIN_PT * 2 - footerHeight;

  const totalRows =
    (cfg.components.subtotal ? 1 : 0) +
    (cfg.components.discount && data.discountAmount > 0 ? 1 : 0) +
    (data.taxAmount > 0 ? 1 : 0);
  const totalsHeight =
    mm(4) +
    totalRows * (line + mm(1)) +
    (cfg.components.total ? mm(4) + (sz + 2) * 1.35 : 0) +
    (cfg.styles.totalsFill ? mm(6) : 0);
  const signatureHeight = cfg.components.signature ? mm(10) + mm(3) + sz * 0.9 * 1.35 : 0;
  const note = data.notes && data.notes.trim() ? data.notes : ctx.labels.thankYou;
  const notesHeight = cfg.components.notes ? mm(8) + estimateLines(note, b.contentWidth, sz - 0.5) * line + mm(4) : 0;

  const rowRule = 0.8 + mm(2) * spacing;
  return {
    usableHeight: usableHeight * 0.98,
    headerHeight: titleHeight + brandRow + fromToHeight,
    continuationHeight: sz * 0.85 * 1.35 + mm(6),
    tableHeaderHeight: mm(HEADER_PAD_Y_MM) * 2 * spacing + line + 0.8,
    extrasHeight: (totalRows || cfg.components.total ? totalsHeight : 0) + signatureHeight + notesHeight,
    rowHeight: (index) => {
      const description = String(data.lineItems[index]?.description || "\u2014");
      return (
        mm(ROW_PAD_Y_MM) * 2 * spacing +
        estimateLines(description, Math.max(40, descWidth - mm(CELL_PAD_X_MM) * 2 * spacing), sz) * line +
        rowRule
      );
    },
  };
}

/** Greedily fills pages, keeping the totals on the page with the last rows. */
function paginate(ctx: Ctx, metrics: PageMetrics): number[][] {
  const items = ctx.data.lineItems;
  const pages: number[][] = [];
  let index = 0;

  do {
    const first = pages.length === 0;
    const available =
      metrics.usableHeight -
      (first ? metrics.headerHeight : metrics.continuationHeight) -
      (items.length > 0 ? metrics.tableHeaderHeight : 0);
    const rows: number[] = [];
    let used = 0;

    while (index < items.length) {
      const height = metrics.rowHeight(index);
      const lastItem = index === items.length - 1;
      const needed = height + (lastItem ? metrics.extrasHeight : 0);
      if (rows.length > 0 && used + needed > available) break;
      used += height;
      rows.push(index);
      index += 1;
    }

    pages.push(rows);
  } while (index < items.length);

  return pages;
}

export function buildInvoiceSpec(data: PDFData): Spec {
  const cfg = mergeTemplateConfig(data.templateConfig, data.templateConfig?.base || "light");
  const fullData: PDFData = { ...data, templateConfig: cfg };
  const page = pageSize(data.paperSize);
  const labels = pdfLabels(data.language);
  const b = new SpecBuilder(cfg, PAGE_WIDTH_PT[page] - MARGIN_PT * 2);
  const theme = PDF_THEMES[cfg.base === "dark" ? "dark" : "light"];
  const sz = b.fontSize;

  const typeName =
    cfg.styles.title ||
    (data.invoiceType === "proforma"
      ? labels.proformaInvoice
      : data.invoiceType && data.invoiceType !== "invoice"
        ? data.invoiceType.charAt(0).toUpperCase() + data.invoiceType.slice(1)
        : labels.invoice);

  // Wide enough for the unit-price header plus its gutter, so it never wraps.
  const moneyWidth = Math.round(
    Math.max(
      92,
      Math.min(sz * 8, b.contentWidth * 0.3),
      labels.unitPrice.length * sz * 0.65 + mm(2)
    )
  );
  const descWidth =
    b.contentWidth -
    (cfg.components.qtyColumn ? 46 : 0) -
    (cfg.components.priceColumn ? 2 : 1) * moneyWidth;

  const ctx: Ctx = {
    b,
    data: fullData,
    cfg,
    theme,
    labels,
    sz,
    accent: cfg.accentColor,
    muted: blend(theme.bg, theme.text, 0.82),
    faint: blend(theme.bg, theme.text, 0.92),
    typeName,
    moneyWidth,
    totalsWidth: Math.round(Math.max(mm(72), Math.min(sz * 15, b.contentWidth * 0.55))),
    descWidth,
    nums: data.numberFormat,
  };

  const hasFooter = cfg.components.footer;
  const metrics = metricsFor(ctx, PAGE_HEIGHT_PT[page], hasFooter);
  const pages = paginate(ctx, metrics);

  const pageProps = {
    size: page,
    backgroundColor: theme.bg,
    marginTop: MARGIN_PT,
    marginBottom: MARGIN_PT,
    marginLeft: MARGIN_PT,
    marginRight: MARGIN_PT,
  };

  const pageKeys: string[] = [];
  pages.forEach((rows, pageIndex) => {
    const lastPage = pageIndex === pages.length - 1;
    const kids: string[] = [];
    kids.push(...(pageIndex === 0 ? documentHeader(ctx) : continuationHeader(ctx)));

    if (fullData.lineItems.length > 0) {
      kids.push(tableHeaderRow(ctx));
      kids.push(dashedRule(b, theme.border, 0, 0));
      rows.forEach((rowIndex, position) => {
        kids.push(itemRow(ctx, rowIndex));
        if (position < rows.length - 1) {
          kids.push(dashedRule(b, blend(theme.bg, theme.border, 0.5)));
        }
      });
    }

    if (lastPage) {
      kids.push(totalsBlock(ctx));
      if (cfg.components.signature) kids.push(buildSignature(b, labels.signature, theme.border));
      if (cfg.components.notes) kids.push(notesBlock(ctx));
    }

    const children: string[] = [b.col({ flex: 1 }, kids)];
    if (hasFooter) children.push(footerFor(ctx, true));
    pageKeys.push(b.page(children, pageProps));
  });

  return b.build(pageKeys, {
    title: `${typeName} ${data.invoiceNumber}`,
    author: data.companyName || "InvoiceFlow",
    subject: `${typeName} ${data.invoiceNumber} \u2014 ${money(ctx, data.total)}`,
  });
}
