"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Mail, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientStore } from "@/store/client-store";
import { useInvoiceStore } from "@/store/invoice-store";
import { useSettingsStore } from "@/store/settings-store";
import { formatCurrency, formatDate } from "@/lib/utils";

function initials(name: string, company: string) {
  const source = name.trim() || company.trim();
  if (!source) return "?";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const { clients, hydrate: hydrateClients, _hydrated: clientsReady } = useClientStore();
  const { invoices, hydrate: hydrateInvoices } = useInvoiceStore();
  const currency = useSettingsStore((state) => state.settings.currency);

  // Both stores start empty and fill from localStorage and the API, so the
  // page waits for the client store before deciding a client is missing.
  useEffect(() => {
    void hydrateClients();
    void hydrateInvoices();
  }, [hydrateClients, hydrateInvoices]);

  const client = clients.find((entry) => entry.id === clientId) ?? null;

  const clientInvoices = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.clientId === clientId)
        .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()),
    [invoices, clientId]
  );

  const { billed, outstanding } = useMemo(() => {
    const live = clientInvoices.filter((invoice) => invoice.status !== "cancelled");
    return {
      billed: live.reduce((sum, invoice) => sum + invoice.total, 0),
      outstanding: live
        .filter((invoice) => invoice.status !== "paid")
        .reduce((sum, invoice) => sum + invoice.balanceDue, 0),
    };
  }, [clientInvoices]);

  if (clientsReady && !client) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4" />
            Clients
          </Link>
        </Button>
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="font-medium">This client is no longer here.</p>
            <p className="text-sm text-gray-500">
              It may have been deleted, or it belongs to a different workspace.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const name = client?.fullName || client?.company || "Client";
  const contactRows = [
    client?.email && { icon: Mail, value: client.email },
    client?.phone && { icon: Phone, value: client.phone },
    client?.address && { icon: MapPin, value: client.address },
    client?.company && client.fullName && { icon: Building2, value: client.company },
  ].filter(Boolean) as { icon: typeof Mail; value: string }[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-gray-900 dark:text-gray-50">{name}</h1>
          <p className="text-sm text-gray-500">
            {client ? `Client since ${formatDate(client.createdAt, "MMMM DD, YYYY")}` : "Loading…"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {initials(client?.fullName ?? "", client?.company ?? "")}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{client?.fullName || client?.company || "—"}</p>
                <p className="text-sm text-gray-500">Primary Contact</p>
              </div>
            </div>
            {contactRows.length > 0 ? (
              <div className="space-y-3">
                {contactRows.map(({ icon: Icon, value }) => (
                  <div key={value} className="flex items-start gap-2 text-sm">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                    <span className="break-words">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No contact details saved for this client.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <p className="text-sm text-gray-500">Total Billed</p>
                  <p className="mt-1 truncate text-xl font-bold">{formatCurrency(billed, currency)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <p className="text-sm text-gray-500">Outstanding</p>
                  <p className="mt-1 truncate text-xl font-bold text-red-500">{formatCurrency(outstanding, currency)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <p className="text-sm text-gray-500">Invoices</p>
                  <p className="mt-1 text-xl font-bold">{clientInvoices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice History</CardTitle>
            </CardHeader>
            <CardContent>
              {clientInvoices.length === 0 ? (
                <div className="space-y-3 py-6 text-center">
                  <p className="text-sm text-gray-500">No invoices for this client yet.</p>
                  <Button size="sm" asChild>
                    <Link href="/invoices/new">Create an invoice</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientInvoices.map((invoice) => (
                    <Link
                      key={invoice.id}
                      href={`/invoices/${invoice.id}`}
                      className="flex flex-col gap-2 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between sm:gap-3 dark:border-gray-800 dark:hover:bg-gray-900"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{invoice.invoiceNumber}</p>
                        <p className="text-xs text-gray-500">{formatDate(invoice.issueDate)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4">
                        <span className="text-sm font-medium">{formatCurrency(invoice.total, currency)}</span>
                        <Badge variant={invoice.status}>
                          {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
