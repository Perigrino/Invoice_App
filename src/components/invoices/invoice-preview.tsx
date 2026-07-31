"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

interface InvoicePreviewProps {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  clientName: string;
  clientAddress: string;
  lineItems: Array<{
    description: string;
    price: number;
    quantity: number;
    total: number;
  }>;
  notes?: string;
  subtotal: number;
  total: number;
}

export function InvoicePreview({
  invoiceNumber,
  issueDate,
  dueDate,
  clientName,
  clientAddress,
  lineItems,
  notes,
  subtotal,
  total,
}: InvoicePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Invoice Preview</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <div
        ref={previewRef}
        className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-950"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              INVOICE
            </h2>
            <p className="text-sm text-gray-500 mt-1">{invoiceNumber}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-gray-900 dark:text-gray-50">
              InvoiceFlow Inc.
            </p>
            <p className="text-sm text-gray-500">
              123 Business Ave, New York, NY 10001
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="flex justify-between mb-8">
          <div>
            <p className="text-xs font-medium uppercase text-gray-400 mb-1">
              Bill To
            </p>
            <p className="font-medium text-gray-900 dark:text-gray-50">
              {clientName}
            </p>
            <p className="text-sm text-gray-500">{clientAddress}</p>
          </div>
          <div className="text-right space-y-1">
            <div className="flex gap-4 text-sm">
              <span className="text-gray-500">Issue Date:</span>
              <span className="font-medium">{issueDate}</span>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-gray-500">Due Date:</span>
              <span className="font-medium">{dueDate}</span>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className="py-2 text-left text-xs font-medium uppercase text-gray-400">
                Description
              </th>
              <th className="py-2 text-right text-xs font-medium uppercase text-gray-400">
                Price
              </th>
              <th className="py-2 text-right text-xs font-medium uppercase text-gray-400">
                Qty
              </th>
              <th className="py-2 text-right text-xs font-medium uppercase text-gray-400">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-3 text-sm">{item.description}</td>
                <td className="py-3 text-sm text-right">
                  ${item.price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                </td>
                <td className="py-3 text-sm text-right">{item.quantity}</td>
                <td className="py-3 text-sm text-right font-medium">
                  ${item.total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>${subtotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2 dark:border-gray-800">
              <span>Total</span>
              <span>${total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {notes && (
          <div className="border-t border-gray-200 pt-4 dark:border-gray-800">
            <p className="text-xs font-medium uppercase text-gray-400 mb-1">
              Notes
            </p>
            <p className="text-sm text-gray-600">{notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
