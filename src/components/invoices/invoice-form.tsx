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
import { LineItemRow } from "./line-item-row";
import { Plus, Save, ArrowLeft, FileDown } from "lucide-react";
import type { LineItem, InvoiceType } from "@/types";
import { useSettingsStore } from "@/store/settings-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useClientStore } from "@/store/client-store";
import { useCompanyStore } from "@/store/company-store";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";


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

export function InvoiceForm({ invoiceId }: InvoiceFormProps) {
  const router = useRouter();
  const { settings } = useSettingsStore();
  const { invoices, hydrate: hydrateInvoices, saveInvoice, updateInvoice } = useInvoiceStore();
  const { clients, hydrate: hydrateClients } = useClientStore();
  const { company } = useCompanyStore();
  const [selectedClientId, setSelectedClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("INV-00001");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [lineItems, dispatch] = useReducer(lineItemsReducer, []);
  const [notes, setNotes] = useState("");
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("invoice");
  const loadedInvoiceId = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    hydrateClients();
    hydrateInvoices();
    setIssueDate(new Date().toISOString().split("T")[0]);
    setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    dispatch({ type: "add" });
    setMounted(true);
  }, [hydrateClients, hydrateInvoices]);

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

  const handleExportPdf = async () => {
    const { exportInvoicePdf } = await import("@/lib/pdf/export-invoice");
    const name = selectedClient?.fullName || selectedClient?.company || "Unknown Client";
    exportInvoicePdf(
      {
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
        notes,
      },
      settings.currency,
      company,
      settings.logo,
      settings.notes,
      settings.paperSize,
      settings.pdfDirectory
    );
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
              {invoiceId ? "Edit Draft" : "Create Invoice"}
            </h1>
            <p className="text-sm text-gray-500">
              {invoiceId ? "Update and save your draft invoice" : "Create a new invoice for your client"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={handleSave}>
            <Save className="h-4 w-4" />
            {invoiceId ? "Save Changes" : "Save Draft"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-0 overflow-hidden min-h-[160px] flex flex-col">
              {settings.logo ? (
                <img
                  src={settings.logo}
                  alt="Company logo"
                  className="w-full flex-1 object-contain p-6"
                />
              ) : (
                <div className="flex-1 flex flex-col justify-center p-6 text-sm text-gray-400">
                  {company.address && <p className="whitespace-pre-line">{company.address}</p>}
                  {company.email && <p className="mt-1">{company.email}</p>}
                  {company.phone && <p className="mt-1">{company.phone}</p>}
                  {!company.address && !company.email && !company.phone && (
                    <span>Add company details in Settings</span>
                  )}
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invoice Details</CardTitle>
              </CardHeader>
              <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoiceNumber">Invoice Number</Label>
                  <Input
                    id="invoiceNumber"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issueDate">Issue Date</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Invoice Type</Label>
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setInvoiceType("invoice")}
                        className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                          invoiceType === "invoice"
                            ? "bg-emerald-500 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-800"
                        }`}
                      >
                        Invoice
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvoiceType("proforma")}
                        className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                          invoiceType === "proforma"
                            ? "bg-emerald-500 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-800"
                        }`}
                      >
                        Proforma
                      </button>
                    </div>
                  </div>
              </div>
            </CardContent>
          </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label>Select Client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Search or select a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName} {c.company ? `- ${c.company}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Products / Services</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => dispatch({ type: "add" })}>
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-800 bg-gradient-to-r from-emerald-50/50 via-white to-violet-50/50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
                      <th className="px-2 py-2 text-left font-medium">Description</th>
                      <th className="px-2 py-2 text-right font-medium w-24">Price</th>
                      <th className="px-2 py-2 text-right font-medium w-20">Qty</th>
                      <th className="px-2 py-2 text-right font-medium">Total</th>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes, payment terms, or instructions..."
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal, settings.currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/50">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(subtotal, settings.currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm p-3 rounded-lg bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/50 dark:to-pink-950/50">
                <span className="text-gray-500">Balance Due</span>
                <span className="font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(subtotal, settings.currency)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <Button type="button" variant="outline" className="w-full" onClick={handleSave}>
                <Save className="h-4 w-4" />
                {invoiceId ? "Save Changes" : "Save Invoice"}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={handleExportPdf}>
                <FileDown className="h-4 w-4" />
                Export PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
