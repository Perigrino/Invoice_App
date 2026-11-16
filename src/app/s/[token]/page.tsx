import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findSharedInvoice, recordShareView } from "@/lib/share-invoice";
import { fromCents } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invoice",
  // Share links are secrets: keep them out of search engines and previews.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(fromCents(cents));
}

function day(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export default async function SharedInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invoice = await findSharedInvoice(token);
  if (!invoice) notFound();

  await recordShareView(invoice.id);

  const settings = invoice.workspace.settings;
  const company = invoice.workspace.company;
  const currency = settings?.currency ?? "USD";
  const client = invoice.client;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-6 text-xs uppercase tracking-wide text-gray-400">
        Read-only invoice
        {invoice.shareViews > 0 ? ` · ${invoice.shareViews + 1} views` : ""}
      </p>

      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-gray-100 pb-6 dark:border-gray-800">
          <div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              {company?.name ?? "Invoice"}
            </p>
            {company?.address && (
              <p className="mt-1 whitespace-pre-line text-sm text-gray-500 dark:text-gray-400">
                {company.address}
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {[company?.email, company?.phone].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              {invoice.invoiceNumber}
            </p>
            <p className="mt-1 text-sm capitalize text-gray-500 dark:text-gray-400">
              {invoice.invoiceType}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Issued {day(invoice.issueDate)}
            </p>
            {invoice.dueDate && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Due {day(invoice.dueDate)}</p>
            )}
          </div>
        </header>

        {client && (
          <section className="py-6">
            <p className="text-xs uppercase tracking-wide text-gray-400">Billed to</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-gray-50">{client.fullName}</p>
            {client.company && <p className="text-sm text-gray-500 dark:text-gray-400">{client.company}</p>}
            {client.address && (
              <p className="whitespace-pre-line text-sm text-gray-500 dark:text-gray-400">{client.address}</p>
            )}
            {client.email && <p className="text-sm text-gray-500 dark:text-gray-400">{client.email}</p>}
          </section>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((line) => (
              <tr key={line.id} className="border-b border-gray-50 align-top dark:border-gray-900">
                <td className="py-3 text-gray-900 dark:text-gray-100">{line.description}</td>
                <td className="py-3 text-right text-gray-500 dark:text-gray-400">{line.quantity}</td>
                <td className="py-3 text-right text-gray-500 dark:text-gray-400">
                  {money(line.priceCents, currency)}
                </td>
                <td className="py-3 text-right text-gray-900 dark:text-gray-100">
                  {money(Math.round(line.priceCents * line.quantity), currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-6 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Subtotal</span>
            <span>{money(invoice.subtotalCents, currency)}</span>
          </div>
          {invoice.discountCents !== 0 && (
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Discount{invoice.discountPercent ? ` (${invoice.discountPercent}%)` : ""}</span>
              <span>−{money(invoice.discountCents, currency)}</span>
            </div>
          )}
          {invoice.taxCents !== 0 && (
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>Tax{invoice.taxPercent ? ` (${invoice.taxPercent}%)` : ""}</span>
              <span>{money(invoice.taxCents, currency)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-50">
            <span>Total</span>
            <span>{money(invoice.totalCents, currency)}</span>
          </div>
        </section>

        {invoice.notes && (
          <section className="mt-8 border-t border-gray-100 pt-4 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">Notes</p>
            <p className="whitespace-pre-line">{invoice.notes}</p>
          </section>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <a
          href={`/s/${token}/pdf`}
          className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-800 dark:bg-gray-50 dark:text-gray-900"
        >
          Download PDF
        </a>
        <p className="text-xs text-gray-400">Generated with InvoiceFlow</p>
      </div>

      <p className="mt-8 text-xs text-gray-400">
        This link is read-only.{" "}
        <Link href="/invoices/new" className="underline hover:text-gray-600">
          Create your own invoice
        </Link>
      </p>
    </main>
  );
}
