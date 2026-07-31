import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency = "GHS",
  locale = "en-GH"
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: Date | string, format = "MM/DD/YYYY") {
  const d = new Date(date);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();

  switch (format) {
    case "DD/MM/YYYY":
      return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    case "MMMM DD, YYYY":
      return `${months[d.getMonth()]} ${day}, ${year}`;
    default:
      return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
  }
}

export function generateInvoiceNumber(prefix = "INV", num = 1) {
  return `${prefix}-${String(num).padStart(5, "0")}`;
}

export function calculateLineTotal(
  price: number,
  quantity: number,
  discount = 0,
  tax = 0
) {
  const subtotal = price * quantity;
  const discountAmount = subtotal * (discount / 100);
  const taxAmount = (subtotal - discountAmount) * (tax / 100);
  return subtotal - discountAmount + taxAmount;
}
