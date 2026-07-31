"use client";

import { useParams } from "next/navigation";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export default function EditInvoicePage() {
  const params = useParams<{ id: string }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          Edit Invoice
        </h1>
      </div>

      <InvoiceForm invoiceId={params.id} />
    </div>
  );
}
