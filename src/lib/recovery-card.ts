/**
 * A printable card, because the recovery key is the whole account: a dialog
 * you read once is easy to lose, a file in a downloads folder is not.
 */
export async function downloadRecoveryCard({
  recoveryKey,
  url,
}: {
  recoveryKey: string;
  url: string;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const width = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(5, 150, 105);
  doc.text("InvoiceFlow", margin, 56);

  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text("Workspace recovery key", margin, 88);

  doc.setFont("courier", "bold");
  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39);
  doc.text(recoveryKey, width / 2, 140, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  const body = [
    "This key is the only way back into your workspace. There are no accounts",
    "and no password reset: if you clear this browser's cookies, or open the",
    "app on another device, this key — or the link below — is what gets your",
    "invoices back.",
    "",
    "Anyone who has it can open your invoices, so keep it somewhere private.",
  ].join("\n");
  doc.text(body, margin, 180, { lineHeightFactor: 1.5 });

  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text(doc.splitTextToSize(url, width - margin * 2), margin, 300, {
    lineHeightFactor: 1.5,
  });

  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(`Saved ${new Date().toLocaleDateString()}`, margin, 520);

  // An explicit blob download, like the other PDF exports in the app: jsPDF's
  // own `save()` prefers the File System Access picker, which asks for a
  // location and fails outright in browsers that restrict it.
  const blobUrl = URL.createObjectURL(doc.output("blob"));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `invoiceflow-recovery-${recoveryKey}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the blob alive until the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}
