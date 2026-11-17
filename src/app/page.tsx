import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getWorkspaceId } from "@/lib/workspace";
import { Welcome } from "@/components/welcome/welcome";

export const metadata: Metadata = {
  title: "InvoiceFlow — make an invoice without an account",
  description:
    "Create an invoice in your browser. No sign-up, no account: your work stays in this browser, and a recovery key is how you get back to it.",
};

/**
 * The front door. There is no sign-in to pass through, but a first-time
 * visitor used to land straight in the invoice form with no idea that the
 * workspace is anonymous or that a key exists. So: a quiet welcome for
 * newcomers, and a plain redirect for anyone this browser already holds
 * invoices for. Reading the workspace id creates nothing — the row appears on
 * the first write — so a crawler or a curious visitor leaves no trace.
 */
export default async function RootPage() {
  const workspaceId = await getWorkspaceId();

  if (workspaceId) {
    const invoices = await prisma.invoice.count({ where: { workspaceId } });
    if (invoices > 0) redirect("/invoices");
  }

  return <Welcome />;
}
