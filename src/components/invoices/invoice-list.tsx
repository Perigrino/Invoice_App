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
  Download,
  MoreHorizontal,
  Trash2,
  Copy,
  FileDown,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useInvoiceStore } from "@/store/invoice-store";
import { useSettingsStore } from "@/store/settings-store";
import { useCompanyStore } from "@/store/company-store";
import Link from "next/link";

export function InvoiceList() {
  const { invoices, hydrate, deleteInvoice, duplicateInvoice } = useInvoiceStore();
  const { settings } = useSettingsStore();
  const { company } = useCompanyStore();
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => { hydrate() }, [hydrate]);

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
            Invoices
          </h1>
          <p className="text-sm text-gray-500">
            Manage your invoices
          </p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            <Plus className="h-4 w-4" />
            New Invoice
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" size="icon">
          <Download className="h-4 w-4" />
        </Button>
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
                <p className="text-xs text-gray-500">{item.clientName}</p>
              </div>
            ),
          },
          {
            key: "total",
            header: "Amount",
            sortable: true,
            cell: (item) => (
              <span className="font-medium">
                {formatCurrency(item.total)}
              </span>
            ),
          },
          {
            key: "issueDate",
            header: "Issued",
            sortable: true,
            cell: (item) => (
              <span className="text-gray-500">
                {formatDate(item.issueDate)}
              </span>
            ),
          },
          {
            key: "dueDate",
            header: "Due",
            sortable: true,
            cell: (item) => (
              <span className="text-gray-500">
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
                  onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
                {menuOpen === item.id && (
                  <div
                    className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-800 dark:bg-gray-950"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                      onClick={() => { duplicateInvoice(item.id); setMenuOpen(null) }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
                      onClick={async () => {
                        const { exportInvoicePdf } = await import("@/lib/pdf/export-invoice");
                        exportInvoicePdf(item, settings.currency, company, settings.logo, settings.notes, settings.paperSize, settings.pdfDirectory, settings.pdfAccentColor, settings.pdfSecondaryColor);
                        setMenuOpen(null);
                      }}
                    >
                      <FileDown className="h-3.5 w-3.5" /> Export PDF
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => { deleteInvoice(item.id); setMenuOpen(null) }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
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
            title="No invoices yet"
            description="Create your first invoice to get started."
            action={
              <Button asChild>
                <Link href="/invoices/new">
                  <Plus className="h-4 w-4" />
                  Create Invoice
                </Link>
              </Button>
            }
          />
        }
      />
    </div>
  );
}
