import jsPDF from "jspdf";

interface PDFLineItem {
  description: string;
  price: number;
  quantity: number;
  total: number;
}

interface PDFData {
  invoiceNumber: string;
  invoiceType: string;
  paperSize: string;
  issueDate: string;
  dueDate: string;
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress: string;
  lineItems: PDFLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  notes?: string;
  currency?: string;
  logo?: string;
}

function formatPdfCurrency(amount: number, currency = "GHS") {
  const formatted = Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${formatted} ${currency}`;
}

const PAGE_BOTTOM = 282;

function getFormatOpts(paperSize: string): { format: string; bottom: number } {
  switch (paperSize) {
    case "A3": return { format: "a3", bottom: 395 };
    case "Letter": return { format: "letter", bottom: 262 };
    case "Legal": return { format: "legal", bottom: 340 };
    default: return { format: "a4", bottom: 282 };
  }
}

export function generateInvoicePDF(data: PDFData): jsPDF {
  const opts = getFormatOpts(data.paperSize);
  const doc = new jsPDF({ format: opts.format } as any);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const rightX = pageWidth - margin;

  const PAGE_BOTTOM = opts.bottom;

  const cyanColor: [number, number, number] = [0, 188, 212];
  const greenColor: [number, number, number] = [5, 150, 105];
  const grayColor: [number, number, number] = [107, 114, 128];
  const violetColor: [number, number, number] = [139, 92, 246];
  const amberColor: [number, number, number] = [245, 158, 11];

  // ── COLUMNS (45% / 20% / 15% / 20%) ──
  const colDesc = margin + 2;
  const colDescEnd = margin + contentWidth * 0.45;
  const colPriceEnd = colDescEnd + contentWidth * 0.20;
  const colQtyCenter = colPriceEnd + contentWidth * 0.075;
  const descWidth = colDescEnd - colDesc - 4;

  doc.setFont("courier");

  const ROW_HEIGHT = 7;

  function drawTableHeader(y: number) {
    doc.setFillColor(240, 249, 255);
    doc.rect(margin, y - 1, rightX - margin, 8, "F");
    doc.setDrawColor(...cyanColor);
    doc.setLineWidth(0.6);
    doc.line(margin, y + 6, rightX, y + 6);
    doc.setFontSize(8);
    doc.setTextColor(...cyanColor);
    doc.setFont("courier", "bold");
    doc.text("Description", colDesc, y + 5);
    doc.text("Price", colPriceEnd, y + 5, { align: "right" });
    doc.text("Qty", colQtyCenter, y + 5, { align: "center" });
    doc.text("Total", rightX, y + 5, { align: "right" });
    doc.setFont("courier", "normal");
  }

  function ensureSpace(startY: number, needed: number): number {
    if (startY + needed > PAGE_BOTTOM) {
      doc.addPage();
      doc.setFont("courier");
      drawTableHeader(margin + 5);
      return margin + 15;
    }
    return startY;
  }

  // ── HEADER ──
  const topY = 22;

  // ── LAYOUT COLUMNS ──
  const leftColW = contentWidth * 0.55;
  const rightColW = contentWidth * 0.41;
  const colGap = contentWidth * 0.04;
  const leftColEnd = margin + leftColW;
  const rightColStart = leftColEnd + colGap;

  // ── LEFT COLUMN: Company logo + address + client card ──
  const logoTop = topY;
  const logoAreaH = 34;
  const logoW = leftColW - 6;
  const logoH = logoAreaH - 2;

  if (data.logo) {
    const imageFormat =
      data.logo.startsWith("data:image/jpeg") || data.logo.startsWith("data:image/jpg")
        ? "JPEG"
        : "PNG";
    try {
      doc.addImage(data.logo, imageFormat, margin + 2, logoTop + 1, logoW, logoH);
    } catch {
      // ignore malformed logo
    }
  }

  // Company details below logo
  let leftContentY = logoTop + logoAreaH + 6;
  const companyLines: string[] = [];
  if (data.companyAddress) companyLines.push(data.companyAddress);
  if (data.companyEmail) companyLines.push(data.companyEmail);
  if (data.companyPhone) companyLines.push(data.companyPhone);

  if (companyLines.length > 0) {
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    const companyInnerW = leftColW - 8;
    for (const line of companyLines) {
      const wrapped = doc.splitTextToSize(line, companyInnerW);
      doc.text(wrapped, margin + 2, leftContentY);
      leftContentY += wrapped.length * 5;
    }
  }

  const leftBlockBottom = leftContentY + 6;

  // ── CLIENT CARD (left column, below company details) ──
  const clientCardTop = leftBlockBottom;
  const clientCardW = leftColW;
  const clientCardPad = 4;
  const clientInnerW = clientCardW - clientCardPad * 2;

  const clientLines: string[] = [];
  if (data.clientEmail) clientLines.push(`Email: ${data.clientEmail}`);
  if (data.clientPhone) clientLines.push(`Tel: ${data.clientPhone}`);
  if (data.clientAddress) clientLines.push(`Address: ${data.clientAddress}`);

  let clientContentY = 0;
  clientContentY += 9;
  clientContentY += 9;
  doc.setFontSize(8);

  for (const line of clientLines) {
    const wrapped = doc.splitTextToSize(line, clientInnerW);
    clientContentY += wrapped.length * 5;
  }

  const clientCardH = clientContentY + 8;

  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margin, clientCardTop - clientCardPad, clientCardW, clientCardH, 2, 2, "FD");

  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.text("Bill To:", margin + clientCardPad, clientCardTop + 4);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont("courier", "bold");
  doc.text(data.clientName, margin + clientCardPad, clientCardTop + 13);
  doc.setFont("courier", "normal");

  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  let detailY = clientCardTop + 20;
  for (const line of clientLines) {
    const wrapped = doc.splitTextToSize(line, clientInnerW);
    doc.text(wrapped, margin + clientCardPad, detailY);
    detailY += wrapped.length * 5;
  }

  const clientEnd = clientCardTop + clientCardH + clientCardPad;

  // ── RIGHT COLUMN: Invoice metadata ──
  let metaY = logoTop;
  doc.setFontSize(28);
  doc.setTextColor(...cyanColor);
  doc.setFont("courier", "bold");
  doc.text(data.invoiceType === "proforma" ? "PROFORMA INVOICE" : "INVOICE", rightX, metaY + 6, { align: "right" });

  doc.setFont("courier", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  metaY += 18;
  doc.text(data.invoiceNumber, rightX, metaY, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  metaY += 8;
  doc.text(`Issue Date: ${data.issueDate}`, rightX, metaY, { align: "right" });

  metaY += 7;
  doc.text(`Due Date: ${data.dueDate}`, rightX, metaY, { align: "right" });

  const headerBottom = Math.max(leftBlockBottom, clientEnd);

  // ── TABLE ──
  const tableTop = Math.max(headerBottom + 2, 112);
  drawTableHeader(tableTop);
  let yPos = tableTop + 10;

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  data.lineItems.forEach((item, idx) => {
    const descLines = doc.splitTextToSize(item.description, descWidth);
    const lineCount = descLines.length;
    const blockHeight = Math.max(lineCount * 5, ROW_HEIGHT);

    yPos = ensureSpace(yPos, blockHeight);

    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, yPos - 3, rightX - margin, blockHeight, "F");
    }

    doc.setTextColor(0, 0, 0);

    doc.text(descLines, colDesc, yPos);

    if (blockHeight > ROW_HEIGHT) {
      const centerY = yPos + blockHeight / 2 + 1.5;
      doc.text(formatPdfCurrency(item.price, data.currency), colPriceEnd, centerY, { align: "right" });
      doc.text(String(item.quantity), colQtyCenter, centerY, { align: "center" });
      doc.text(formatPdfCurrency(item.total, data.currency), rightX, centerY, { align: "right" });
    } else {
      doc.text(formatPdfCurrency(item.price, data.currency), colPriceEnd, yPos, { align: "right" });
      doc.text(String(item.quantity), colQtyCenter, yPos, { align: "center" });
      doc.text(formatPdfCurrency(item.total, data.currency), rightX, yPos, { align: "right" });
    }

    yPos += blockHeight;
  });

  // ── TOTALS ──
  yPos = ensureSpace(yPos, 30);
  yPos += 4;

  const totalsLeft = rightX - 60;

  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.text("Subtotal:", totalsLeft, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(formatPdfCurrency(data.subtotal, data.currency), rightX, yPos, { align: "right" });
  yPos += 7;

  if (data.discount > 0) {
    doc.setTextColor(...grayColor);
    doc.text("Discount:", totalsLeft, yPos);
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatPdfCurrency(data.discount, data.currency)}`, rightX, yPos, { align: "right" });
    yPos += 7;
  }

  yPos += 2;
  doc.setDrawColor(...greenColor);
  doc.setLineWidth(0.5);
  doc.line(totalsLeft, yPos, rightX, yPos);
  yPos += 7;

  doc.setFillColor(236, 253, 245);
  doc.rect(totalsLeft, yPos - 2, rightX - totalsLeft, 8, "F");

  doc.setFontSize(11);
  doc.setTextColor(...greenColor);
  doc.text("Total:", totalsLeft, yPos + 3);
  doc.setFont("courier", "bold");
  doc.text(formatPdfCurrency(data.total, data.currency), rightX, yPos + 3, { align: "right" });
  doc.setFont("courier", "normal");

  // ── NOTES ──
  if (data.notes) {
    yPos = ensureSpace(yPos, 50);
    yPos += 24;
    doc.setDrawColor(...amberColor);
    doc.setLineWidth(0.4);
    doc.line(margin, yPos, rightX, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const wrapped = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(wrapped, pageWidth / 2, yPos, { align: "center" });
  }

  return doc;
}
