"use client";

import { useState, useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LineItemRow } from "./line-item-row";
import { LivePdfPreview } from "./live-pdf-preview";
import { PdfPreviewDialog } from "./pdf-preview-dialog";
import { Combobox } from "@/components/ui/combobox";
import { Plus, Save, ArrowLeft, FileDown, AlertTriangle, X, FileText, Eye } from "lucide-react";
import type { LineItem, InvoiceType, TemplateType } from "@/types";
import { TEMPLATE_ORDER } from "@/lib/templates/presets";
import { useSettingsStore } from "@/store/settings-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useClientStore } from "@/store/client-store";
import { useCompanyStore } from "@/store/company-store";
import { useProfileStore } from "@/store/profile-store";
import { cn, formatCurrency } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { PdfExportParams } from "@/lib/pdf/export-invoice";
import Link from "next/link";
import type { PreviewInvoiceData } from "./template-editor/preview/types";


function genId() {
  return Math.random().toString(36).substring(2, 9);
}

type Action =
  | { type: "add" }
  | { type: "load"; items: LineItem[] }
  | { type: "update"; id: string; data: Partial<LineItem> }
  | { type: "remove"; id: string }
  | { type: "duplicate"; id: string };

function lineItemsReducer(state: LineItem[], action: Action): LineItem[] {
  switch (action.type) {
    case "load":
      return action.items.length > 0 ? action.items : [];
    case "add":
      return [...state, { id: genId(), description: "", price: 0, quantity: 1 }];
    case "update":
      return state.map((item) =>
        item.id === action.id ? { ...item, ...action.data } : item
      );
    case "remove":
      return state.filter((item) => item.id !== action.id);
    case "duplicate": {
      const source = state.find((item) => item.id === action.id);
      return source ? [...state, { ...source, id: genId() }] : state;
    }
    default:
      return state;
  }
}

interface InvoiceFormProps {
  invoiceId?: string;
}

interface FormErrors {
  client: boolean;
  items: boolean;
  notes: boolean;
}

const NO_ERRORS: FormErrors = { client: false, items: false, notes: false };

export function InvoiceForm({ invoiceId }: InvoiceFormProps) {
  const router = useRouter();
  const t = useTranslation();
  const { settings } = useSettingsStore();
  const { invoices, hydrate: hydrateInvoices, saveInvoice, updateInvoice } = useInvoiceStore();
  const { clients, hydrate: hydrateClients } = useClientStore();
  const { company } = useCompanyStore();
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const activeProfileName = profiles.find((p) => p.id === activeProfileId)?.name || "profile";
  const [selectedClientId, setSelectedClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("INV-00001");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lineItems, dispatch] = useReducer(lineItemsReducer, []);
  const [notes, setNotes] = useState("");
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("invoice");
  const loadedInvoiceId = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS);
  const [defaultNotePromptOpen, setDefaultNotePromptOpen] = useState(false);
  const [noNotePromptOpen, setNoNotePromptOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("modern");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewInvoiceData | null>(null);

  useEffect(() => {
    hydrateClients();
    hydrateInvoices();
    setIssueDate(new Date().toISOString().split("T")[0]);
    setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    dispatch({ type: "add" });
    setSelectedTemplate(settings.template);
    setMounted(true);
  }, [hydrateClients, hydrateInvoices, settings.template]);

  const savedInvoice = invoices.find((invoice) => invoice.id === invoiceId);

  useEffect(() => {
    if (!savedInvoice || loadedInvoiceId.current === savedInvoice.id) return;
    setSelectedClientId(savedInvoice.clientId);
    setInvoiceNumber(savedInvoice.invoiceNumber);
    setIssueDate(savedInvoice.issueDate.split("T")[0]);
    setDueDate(savedInvoice.dueDate?.split("T")[0] || "");
    dispatch({ type: "load", items: savedInvoice.lineItems });
    setNotes(savedInvoice.notes);
    setInvoiceType(savedInvoice.invoiceType);
    loadedInvoiceId.current = savedInvoice.id;
  }, [savedInvoice]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // Auto-save timer — saves every 60 seconds when editing an existing invoice
  useEffect(() => {
    if (!settings.autoSave || !invoiceId) return;
    const interval = setInterval(() => {
      const clientName =
        selectedClient?.fullName ||
        selectedClient?.company ||
        savedInvoice?.clientName ||
        "No client selected";
      if (!selectedClientId || lineItems.length === 0) return;
      updateInvoice(invoiceId, {
        invoiceNumber,
        issueDate: new Date(issueDate),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        status: "pending" as const,
        invoiceType,
        clientId: selectedClientId,
        lineItems,
        notes,
        discount: 0,
      }, clientName);
    }, 60_000);
    return () => clearInterval(interval);
  }, [settings.autoSave, invoiceId, selectedClientId, invoiceNumber, issueDate, dueDate, invoiceType, lineItems, notes, selectedClient, savedInvoice, updateInvoice]);

  // Auto-generate invoice number when client changes (new invoices only)
  useEffect(() => {
    if (invoiceId) return;
    if (!selectedClient) return;
    const name = selectedClient.fullName || selectedClient.company || "CLI";
    const prefix = name.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase();
    if (!prefix || prefix.length < 3) return;
    const rand = Math.floor(100000 + Math.random() * 900000);
    const year = new Date().getFullYear().toString().slice(-2);
    setInvoiceNumber(`${prefix}-${rand}-${year}`);
  }, [selectedClient, invoiceId]);

  const subtotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0
  );

  const handleSave = () => {
    const data = {
      invoiceNumber,
      issueDate: new Date(issueDate),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      status: "pending" as const,
      invoiceType,
      clientId: selectedClientId,
      lineItems,
      notes,
      discount: 0,
    };
    const clientName =
      selectedClient?.fullName ||
      selectedClient?.company ||
      savedInvoice?.clientName ||
      "No client selected";

    if (invoiceId) {
      updateInvoice(invoiceId, data, clientName);
    } else {
      saveInvoice(data, clientName);
    }
    router.push("/invoices");
  };

  const buildPreviewData = (): PreviewInvoiceData => {
    const name = selectedClient?.fullName || selectedClient?.company || "Unknown Client";
    return {
      invoiceNumber,
      invoiceType,
      issueDate,
      dueDate: dueDate || "—",
      clientName: name,
      clientEmail: selectedClient?.email,
      clientPhone: selectedClient?.phone,
      clientAddress: selectedClient?.address,
      companyName: company.name || company.fullName || "",
      companyAddress: company.address,
      companyEmail: company.email,
      companyPhone: company.phone,
      logo: settings.logo,
      lineItems: lineItems.map((item) => ({
        description: item.description,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        total: (Number(item.price) || 0) * (Number(item.quantity) || 1),
      })),
      subtotal,
      discount: 0,
      total: subtotal,
      notes,
      currency: settings.currency,
    };
  };

  const buildExportParams = (noteText: string, tpl?: TemplateType): PdfExportParams => {
    const name = selectedClient?.fullName || selectedClient?.company || "Unknown Client";
    return {
      invoice: {
        invoiceNumber,
        issueDate,
        dueDate: dueDate || null,
        invoiceType,
        clientName: name,
        clientEmail: selectedClient?.email,
        clientPhone: selectedClient?.phone,
        clientAddress: selectedClient?.address,
        lineItems,
        subtotal,
        discount: 0,
        total: subtotal,
        notes: noteText,
      },
      currency: settings.currency,
      company,
      logo: settings.logo,
      settingsNotes: settings.notes === noteText ? "" : settings.notes,
      paperSize: settings.paperSize,
      pdfDirectory: settings.pdfDirectory,
      accentColor: settings.pdfAccentColor,
      secondaryColor: settings.pdfSecondaryColor,
      template: tpl || selectedTemplate,
    };
  };

  const doExportPdf = async (noteText: string, tpl?: TemplateType) => {
    const { exportInvoicePdf } = await import("@/lib/pdf/export-invoice");
    const { downloadPdfBuffer, pdfFilename } = await import("@/lib/pdf/download");
    const buffer = await exportInvoicePdf(buildExportParams(noteText, tpl));
    downloadPdfBuffer(buffer, pdfFilename(invoiceNumber, settings.pdfDirectory));
  };

  const handleExportPdf = async () => {
    const nextErrors: FormErrors = {
      client: !selectedClientId,
      items: lineItems.length === 0,
      notes: !notes.trim(),
    };
    setErrors(nextErrors);
    if (nextErrors.client || nextErrors.items) {
      return;
    }
    if (nextErrors.notes) {
      if (settings.notes?.trim()) {
        setDefaultNotePromptOpen(true);
      } else {
        setNoNotePromptOpen(true);
      }
      return;
    }
    setPreviewData(buildPreviewData());
    setPreviewOpen(true);
  };

  const handleUseDefaultNote = async () => {
    const noteText = settings.notes;
    setNotes(noteText);
    setErrors(NO_ERRORS);
    setDefaultNotePromptOpen(false);
    setPreviewData(buildPreviewData());
    setPreviewOpen(true);
  };

  if (!mounted) {
    return <div className="h-[600px]" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" size="icon" asChild>
            <Link href="/invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              {invoiceId ? t.editDraft : t.createInvoice}
            </h1>
            <p className="text-sm text-gray-500">
              {invoiceId ? t.updateAndSaveDraft : t.createNewInvoice}
            </p>
          </div>
        </div>
      </div>

      {errors.client || errors.items || errors.notes ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {t.cannotExportYet}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-700 dark:text-amber-400">
              {errors.client && <li>{t.selectClientError}</li>}
              {errors.items && <li>{t.addLineItemError}</li>}
              {errors.notes && <li>{t.addNoteError}</li>}
            </ul>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-amber-600 hover:text-amber-800 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50"
            onClick={() => setErrors(NO_ERRORS)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-0 overflow-hidden min-h-[160px] flex flex-col">
            {settings.logo ? (
              <img
                src={settings.logo}
                alt="Company logo"
                className="w-full flex-1 object-contain p-6"
              />
            ) : (
              <div className="flex-1 flex flex-col justify-center p-6 text-sm text-gray-400">
                <span className="text-gray-900 dark:text-gray-100 font-semibold text-base">
                  {company.name || company.fullName || "Company Name"}
                </span>
                {company.address && <p className="mt-2 whitespace-pre-line">{company.address}</p>}
                {company.email && <p className="mt-1">{company.email}</p>}
                {company.phone && <p className="mt-1">{company.phone}</p>}
              </div>
            )}
            {(settings.logo && (company.address || company.email || company.phone)) && (
              <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-3 text-xs text-gray-500">
                {company.address && <p className="whitespace-pre-line">{company.address}</p>}
                {company.email && <p>{company.email}</p>}
                {company.phone && <p>{company.phone}</p>}
              </div>
            )}
          </div>

          <Card className={errors.client ? "border-red-300 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-900/50" : undefined}>
            <CardHeader>
              <CardTitle className="text-base">{t.client}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>{t.selectClient}</Label>
                <Combobox
                  value={selectedClientId}
                  onValueChange={(id) => {
                    setSelectedClientId(id);
                    if (id && errors.client) setErrors((prev) => ({ ...prev, client: false }));
                  }}
                  options={clients.map((c) => ({
                    value: c.id,
                    label: c.fullName + (c.company ? ` - ${c.company}` : ""),
                    keywords: `${c.fullName} ${c.company || ""} ${c.email || ""} ${c.phone || ""} ${c.address || ""}`,
                  }))}
                  placeholder={t.selectClient}
                  emptyText={t.noResultsFound}
                  className={errors.client ? "border-red-400 focus:ring-red-400 focus:border-red-400 dark:border-red-700" : undefined}
                />
                {errors.client && (
                  <p className="text-xs font-medium text-red-500">{t.selectClientToContinue}</p>
                )}
              </div>
              {selectedClient && (
                <div className="grid grid-cols-2 gap-4 mt-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <p className="text-sm"><span className="text-gray-500">Name:</span> {selectedClient.fullName}</p>
                  <p className="text-sm"><span className="text-gray-500">Company:</span> {selectedClient.company}</p>
                  <p className="text-sm"><span className="text-gray-500">Email:</span> {selectedClient.email}</p>
                  <p className="text-sm"><span className="text-gray-500">Phone:</span> {selectedClient.phone}</p>
                  <p className="text-sm col-span-2"><span className="text-gray-500">Address:</span> {selectedClient.address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={errors.items ? "border-red-300 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-900/50" : undefined}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t.productsServices}</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  dispatch({ type: "add" });
                  if (errors.items) setErrors((prev) => ({ ...prev, items: false }));
                }}
              >
                <Plus className="h-4 w-4" />
                {t.addItem}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-800 bg-gradient-to-r from-emerald-50/50 via-white to-violet-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
                      <th className="px-2 py-2 text-left font-medium">{t.description}</th>
                      <th className="px-2 py-2 text-right font-medium w-24">{t.price}</th>
                      <th className="px-2 py-2 text-right font-medium w-20">{t.qty}</th>
                      <th className="px-2 py-2 text-right font-medium">{t.total}</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, index) => (
                      <LineItemRow
                        key={item.id}
                        item={item}
                        index={index}
                        currency={settings.currency}
                        onUpdate={(id, data) => dispatch({ type: "update", id, data })}
                        onRemove={(id) => dispatch({ type: "remove", id })}
                        onDuplicate={(id) => dispatch({ type: "duplicate", id })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className={errors.notes ? "border-red-300 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-900/50" : undefined}>
            <CardContent className="pt-6">
              <Textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  if (e.target.value.trim() && errors.notes) setErrors((prev) => ({ ...prev, notes: false }));
                }}
                placeholder={t.notesPlaceholder}
                className={cn("min-h-[100px]", errors.notes && "border-red-400 focus:ring-red-400 focus:border-red-400 dark:border-red-700")}
              />
              {errors.notes && (
                <p className="mt-1 text-xs font-medium text-red-500">{t.pleaseAddNote}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.invoiceDetails}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">{t.invoiceNumber}</Label>
                <Input
                  id="invoiceNumber"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="font-medium"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issueDate">{t.issueDate}</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">{t.dueDate}</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.invoiceType}</Label>
                <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setInvoiceType("invoice")}
                    className={`flex-1 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors ${
                      invoiceType === "invoice"
                        ? "bg-emerald-500 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
                  >
                    {t.invoice}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceType("proforma")}
                    className={`flex-1 whitespace-nowrap border-l border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium transition-colors ${
                      invoiceType === "proforma"
                        ? "bg-emerald-500 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
                  >
                    {t.proformaInvoice}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.summary}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t.subtotal}</span>
                <span className="font-medium">{formatCurrency(subtotal, settings.currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/50">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(subtotal, settings.currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm p-3 rounded-lg bg-gradient-to-r from-violet-50 to-violet-100 dark:from-violet-950/50 dark:to-violet-900/50">
                <span className="text-gray-500">{t.balanceDue}</span>
                <span className="font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(subtotal, settings.currency)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.pdfTemplate}</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v as TemplateType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <Button type="button" variant="outline" className="w-full" onClick={handleSave}>
                <Save className="h-4 w-4" />
                {invoiceId ? t.saveChanges : t.saveInvoice}
              </Button>
              <Button type="button" className="w-full" onClick={handleExportPdf}>
                <Eye className="h-4 w-4" />
                {t.previewExportPdf}
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">{t.livePreview}</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-3 overflow-hidden">
                <LivePdfPreview params={buildExportParams(notes)} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={defaultNotePromptOpen} onOpenChange={setDefaultNotePromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              {t.useDefaultNote}
            </DialogTitle>
            <DialogDescription>
              You haven&apos;t added a note to this invoice. Your profile has a saved default note. Would you like to use it?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
              Default note from {activeProfileName}
            </p>
            <p className="whitespace-pre-line">{settings.notes}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDefaultNotePromptOpen(false)}>
              {t.notNow}
            </Button>
            <Button type="button" onClick={handleUseDefaultNote}>
              <FileDown className="h-4 w-4" />
              {t.useNoteAndExport}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noNotePromptOpen} onOpenChange={setNoNotePromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              {t.addNoteToExport}
            </DialogTitle>
            <DialogDescription>
              {t.addNoteToExportDesc}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNoNotePromptOpen(false)}>
              {t.addNote}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/settings">{t.setDefaultNote}</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewData && (
        <PdfPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          params={buildExportParams(notes)}
          onDownload={async (tpl) => {
            await doExportPdf(notes, tpl);
            setPreviewOpen(false);
          }}
        />
      )}
    </div>
  );
}
