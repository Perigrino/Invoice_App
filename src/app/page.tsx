import { redirect } from "next/navigation";

// No sign-in step: hitting the URL drops straight into a new invoice.
export default function RootPage() {
  redirect("/invoices/new");
}
