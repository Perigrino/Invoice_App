"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Copy,
  FileDown,
  Eye,
  ChevronRight,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useInvoiceStore } from "@/store/invoice-store";
import { useSettingsStore } from "@/store/settings-store";
import { useCompanyStore } from "@/store/company-store";
import { useTranslation } from "@/lib/i18n";
import { TEMPLATE_ORDER } from "@/lib/templates/presets";
import type { TemplateType } from "@/types";
import type { SavedInvoice } from "@/store/invoice-store";
import type { PdfExportParams } from "@/lib/pdf/export-invoice";
import { PdfPreviewDialog } from "./pdf-preview-dialog";
import Link from "next/link";

export function InvoiceList() {
  const t = useTranslation();
  const { invoices, hydrate, deleteInvoice, duplicateInvoice } = useInvoiceStore();
  const { settings } = useSettingsStore();
  const { company } = useCompanyStore();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [templateSubmenu, setTemplateSubmenu] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<SavedInvoice | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateType>("modern");

  useEffect(() => { hydrate(); }, [hydrate]);

  const buildListParams = (item: SavedInvoice, template: string): PdfExportParams => ({
    invoice: item,
    currency: settings.currency,
    company,
    logo: settings.logo,
    settingsNotes: settings.notes,
    paperSize: settings.paperSize,
    pdfDirectory: settings.pdfDirectory,
    accentColor: settings.pdfAccentColor,
    secondaryColor: settings.pdfSecondaryColor,
    template,
  });

  const handleExportWithTemplate = async (item: SavedInvoice, template: TemplateType) => {
    const { exportInvoicePdf } = await import("@/lib/pdf/export-invoice");
    const { downloadPdfBuffer, pdfFilename } = await import("@/lib/pdf/download");
    const buffer = await exportInvoicePdf(buildListParams(item, template));
    downloadPdfBuffer(buffer, pdfFilename(item.invoiceNumber, settings.pdfDirectory));
    setMenuOpen(null);
    setTemplateSubmenu(null);
  };

  const handleViewPdf = (item: SavedInvoice) => {
    setPreviewInvoice(item);
    setPreviewTemplate(settings.template);
    setPreviewOpen(true);
    setMenuOpen(null);
  };

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            {t.invoices}
          </h1>
          <p className="text-sm text-gray-500">
            {t.manageInvoices}
          </p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            <Plus className="h-4 w-4" />
            {t.newInvoice}
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder={t.searchInvoices}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <DataTable
        columns={[
          {
            key: "invoiceNumber",
            header: "Invoice",
            sortable: true,
            cell: (item) => (
              <div>
                <Link
                  href={`/invoices/${item.id}`}
                  className="font-medium hover:text-emerald-600 hover:underline"
                >
                  {item.invoiceNumber}
                </Link>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.clientName}</p>
              </div>
            ),
          },
          {
            key: "total",
            header: t.amount,
            sortable: true,
            cell: (item) => (
              <span className="font-medium">
                {formatCurrency(item.total)}
              </span>
            ),
          },
          {
            key: "issueDate",
            header: t.issued,
            sortable: true,
            cell: (item) => (
              <span className="text-gray-500 dark:text-gray-400">
                {formatDate(item.issueDate)}
              </span>
            ),
          },
          {
            key: "dueDate",
            header: t.due,
            sortable: true,
            cell: (item) => (
              <span className="text-gray-500 dark:text-gray-400">
                {item.dueDate ? formatDate(item.dueDate) : "-"}
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "w-12 relative",
            cell: (item) => (
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setMenuOpen(menuOpen === item.id ? null : item.id);
                    setTemplateSubmenu(null);
                  }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
                {menuOpen === item.id && (
                  <div
                    className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-950"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                      onClick={() => { duplicateInvoice(item.id); setMenuOpen(null) }}
                    >
                      <Copy className="h-3.5 w-3.5" /> {t.duplicate}
                    </button>
                    {templateSubmenu === item.id ? (
                      <div>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900"
                          onClick={() => setTemplateSubmenu(null)}
                        >
                          <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Back
                        </button>
                        {TEMPLATE_ORDER.map((t_) => (
                          <button
                            key={t_}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-1.5 pl-6 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                            onClick={() => handleExportWithTemplate(item, t_)}
                          >
                            <FileDown className="h-3.5 w-3.5" /> {t_.charAt(0).toUpperCase() + t_.slice(1)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                          onClick={() => setTemplateSubmenu(item.id)}
                        >
                          <FileDown className="h-3.5 w-3.5" /> {t.exportPdf} <ChevronRight className="h-3 w-3 ml-auto" />
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                          onClick={() => handleViewPdf(item)}
                        >
                          <Eye className="h-3.5 w-3.5" /> {t.viewPdf}
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={() => { deleteInvoice(item.id); setMenuOpen(null) }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> {t.delete}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ),
          },
        ]}
        data={filtered}
        emptyState={
          <EmptyState
            icon={<FileText className="h-12 w-12" />}
            title={t.noInvoicesYet}
            description={t.createFirstInvoice}
            action={
              <Button asChild>
                <Link href="/invoices/new">
                  <Plus className="h-4 w-4" />
                  {t.createInvoiceBtn}
                </Link>
              </Button>
            }
          />
        }
      />

      {previewInvoice && (
        <PdfPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          params={buildListParams(previewInvoice, previewTemplate)}
          onDownload={async (tpl) => {
            const { exportInvoicePdf } = await import("@/lib/pdf/export-invoice");
            const { downloadPdfBuffer, pdfFilename } = await import("@/lib/pdf/download");
            const buffer = await exportInvoicePdf(buildListParams(previewInvoice, tpl));
            downloadPdfBuffer(buffer, pdfFilename(previewInvoice.invoiceNumber, settings.pdfDirectory));
            setPreviewOpen(false);
          }}
        />
      )}
    </div>
  );
}
