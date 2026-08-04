import { View, Text } from "@react-pdf/renderer";
import { createElement } from "react";
import type { ReactNode } from "react";
import type { Style } from "@react-pdf/types";

interface RegistryElement {
  props: Record<string, unknown>;
}

interface RegistryComponentProps {
  element: RegistryElement;
  children?: ReactNode;
}

const BOLD: Record<string, string> = {
  Courier: "Courier-Bold",
  Helvetica: "Helvetica-Bold",
  "Times-Roman": "Times-Bold",
};

const ITALIC: Record<string, string> = {
  Courier: "Courier-Oblique",
  Helvetica: "Helvetica-Oblique",
  "Times-Roman": "Times-Italic",
};

const BOLD_ITALIC: Record<string, string> = {
  Courier: "Courier-BoldOblique",
  Helvetica: "Helvetica-BoldOblique",
  "Times-Roman": "Times-BoldItalic",
};

function resolveFontFamily(family: string, weight?: string, style?: string): string {
  const bold = weight === "bold";
  const italic = style === "italic";
  if (bold && italic) return BOLD_ITALIC[family] ?? family;
  if (bold) return BOLD[family] ?? family;
  if (italic) return ITALIC[family] ?? family;
  return family;
}

function RichView({ element, children }: RegistryComponentProps) {
  return createElement(View, { style: (element.props.style as Style | undefined) ?? {} }, children);
}

function RichText({ element }: RegistryComponentProps) {
  const p = element.props;
  const style: Style = { ...((p.style as Style | undefined) ?? {}) };
  style.fontFamily = resolveFontFamily(
    String(p.fontFamily ?? "Helvetica"),
    typeof p.fontWeight === "string" ? p.fontWeight : undefined,
    typeof p.fontStyle === "string" ? p.fontStyle : undefined
  );
  return createElement(Text, { style }, String(p.text ?? ""));
}

export const pdfRegistry: Record<string, React.ComponentType<RegistryComponentProps>> = {
  View: RichView,
  Text: RichText,
};
