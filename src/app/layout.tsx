import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { TranslationProvider } from "@/lib/i18n";
import { HtmlLang } from "@/components/html-lang";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "InvoiceFlow - Invoice Generator",
  description: "Modern invoice generation application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${plusJakartaSans.variable} h-full antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TranslationProvider>
            <HtmlLang />
            {children}
          </TranslationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
