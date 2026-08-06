"use client";

import { useEffect, useRef, useState } from "react";
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
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useInvoiceStore } from "@/store/invoice-store";
import { useSettingsStore } from "@/store/settings-store";
import { useCompanyStore } from "@/store/company-store";
import { useTranslation } from "@/lib/i18n";
import { TEMPLATE_ORDER } from "@/lib/templates/presets";
import type { TemplateType, InvoiceStatus } from "@/types";
import type { SavedInvoice } from "@/store/invoice-store";
import type { PdfExportParams } from "@/lib/pdf/export-invoice";
import { PdfPreviewDialog } from "./pdf-preview-dialog";
import Link from "next/link";

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

interface InvoiceRowMenuProps {
  item: SavedInvoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submenu: boolean;
  onSubmenuChange: (open: boolean) => void;
  onDuplicate: () => void;
  onExport: (template: TemplateType) => void;
  onView: () => void;
  onDelete: () => void;
}

function InvoiceRowMenu({
  open,
  onOpenChange,
  submenu,
  onSubmenuChange,
  onDuplicate,
  onExport,
  onView,
  onDelete,
}: InvoiceRowMenuProps) {
  const t = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onOpenChange]);

  const toggle = () => {
    onOpenChange(!open);
    onSubmenuChange(false);
  };

  const menuItemClass = "flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900 lg:py-1.5";

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 lg:h-8 lg:w-8"
        onClick={toggle}
        aria-label="Invoice actions"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-950">
          <button
            type="button"
            className={menuItemClass}
            onClick={() => { onDuplicate(); }}
          >
            <Copy className="h-3.5 w-3.5" /> {t.duplicate}
          </button>
          {submenu ? (
            <div>
              <button
                type="button"
                className={cn(menuItemClass, "text-gray-500 dark:text-gray-400")}
                onClick={() => onSubmenuChange(false)}
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Back
              </button>
              {TEMPLATE_ORDER.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  className={cn(menuItemClass, "pl-6")}
                  onClick={() => onExport(tpl)}
                >
                  <FileDown className="h-3.5 w-3.5" /> {tpl.charAt(0).toUpperCase() + tpl.slice(1)}
                </button>
              ))}
            </div>
          ) : (
            <>
              <button
                type="button"
                className={menuItemClass}
                onClick={() => onSubmenuChange(true)}
              >
                <FileDown className="h-3.5 w-3.5" /> {t.exportPdf} <ChevronRight className="h-3 w-3 ml-auto" />
              </button>
              <button
                type="button"
                className={menuItemClass}
                onClick={onView}
              >
                <Eye className="h-3.5 w-3.5" /> {t.viewPdf}
              </button>
              <button
                type="button"
                className={cn(menuItemClass, "text-red-500 hover:bg-red-50 dark:hover:bg-red-950 dark:text-red-400")}
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" /> {t.delete}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

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
        <Button asChild className="hidden md:inline-flex">
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
            className: "w-14",
            cell: (item) => (
              <InvoiceRowMenu
                item={item}
                open={menuOpen === item.id}
                onOpenChange={(o) => setMenuOpen(o ? item.id : null)}
                submenu={templateSubmenu === item.id}
                onSubmenuChange={(o) => setTemplateSubmenu(o ? item.id : null)}
                onDuplicate={() => { duplicateInvoice(item.id); setMenuOpen(null); }}
                onExport={(tpl) => handleExportWithTemplate(item, tpl)}
                onView={() => handleViewPdf(item)}
                onDelete={() => { deleteInvoice(item.id); setMenuOpen(null); }}
              />
            ),
          },
        ]}
        data={filtered}
        renderCard={(item) => (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/invoices/${item.id}`} className="min-w-0">
                <p className="truncate font-semibold text-gray-900 dark:text-gray-50">
                  {item.invoiceNumber}
                </p>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                  {item.clientName}
                </p>
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <span className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  STATUS_STYLES[item.status] ?? STATUS_STYLES.draft
                )}>
                  {STATUS_LABEL[item.status] ?? "Draft"}
                </span>
                <InvoiceRowMenu
                  item={item}
                  open={menuOpen === item.id}
                  onOpenChange={(o) => setMenuOpen(o ? item.id : null)}
                  submenu={templateSubmenu === item.id}
                  onSubmenuChange={(o) => setTemplateSubmenu(o ? item.id : null)}
                  onDuplicate={() => { duplicateInvoice(item.id); setMenuOpen(null); }}
                  onExport={(tpl) => handleExportWithTemplate(item, tpl)}
                  onView={() => handleViewPdf(item)}
                  onDelete={() => { deleteInvoice(item.id); setMenuOpen(null); }}
                />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-50">
                {formatCurrency(item.total)}
              </p>
              <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                <p>
                  {t.issued} {formatDate(item.issueDate)}
                </p>
                <p>
                  {t.due} {item.dueDate ? formatDate(item.dueDate) : "-"}
                </p>
              </div>
            </div>
          </div>
        )}
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

      <Link
        href="/invoices/new"
        aria-label={t.newInvoice}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] right-5 z-30 md:hidden"
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/40 transition-transform active:scale-95">
          <Plus className="h-6 w-6" />
        </span>
      </Link>

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
