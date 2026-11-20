"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Check,
  ChevronDown,
  FileDown,
  LayoutTemplate,
  Loader2,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import { LivePdfPreview } from "./live-pdf-preview";
import {
  mergeTemplateConfig,
  normalizeTemplate,
  TEMPLATE_ORDER,
} from "@/lib/templates/presets";
import {
  COMPONENT_OPTIONS,
  FONT_OPTIONS,
  SPACING_OPTIONS,
} from "@/lib/templates/constants";
import type {
  TemplateComponents,
  TemplateConfig,
  TemplateFont,
  TemplateLogoSize,
  TemplateSpacing,
  TemplateStyles,
} from "@/lib/templates/types";
import { useTranslation } from "@/lib/i18n";
import { useSettingsStore } from "@/store/settings-store";
import { cachedPdf, pdfParamsKey } from "@/lib/pdf/preview-cache";
import type { PdfExportParams } from "@/lib/pdf/export-invoice";
import type { PaperSize, TemplateType } from "@/types";

const PAPER_SIZES = ["A4", "A3", "Letter", "Legal"] as const;
const FONT_SIZES = [7, 8, 9, 10, 11, 12, 14, 16, 18];
const LOGO_SIZES: Array<{ value: TemplateLogoSize; label: string }> = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];
const SWATCH_CLASS =
  "h-8 w-9 cursor-pointer rounded-md border border-gray-200 bg-transparent p-0.5 dark:border-gray-700";
const STYLE_OPTIONS: Array<{ key: keyof Pick<TemplateStyles, "tableHeaderFill" | "zebraRows" | "totalsFill">; label: string }> = [
  { key: "tableHeaderFill", label: "Header fill" },
  { key: "zebraRows", label: "Zebra rows" },
  { key: "totalsFill", label: "Totals fill" },
];

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: PdfExportParams;
  /** Receives the exact params the preview was drawn with, plus its bytes. */
  onDownload: (params: PdfExportParams, bytes?: Uint8Array) => Promise<void>;
  title?: string;
}

function initialPaperSize(params: PdfExportParams): PaperSize {
  const paper = (params.paperSize ?? "A3").toUpperCase();
  return PAPER_SIZES.find((size) => size.toUpperCase() === paper) ?? "A4";
}

/** The dialog edits one TemplateConfig plus the page size, seeded from the invoice. */
function initialConfig(params: PdfExportParams): TemplateConfig {
  const base = normalizeTemplate(params.template);
  const config = mergeTemplateConfig(params.templateConfig, base);
  return {
    ...config,
    base,
    accentColor: params.accentColor ?? config.accentColor,
    secondaryColor: params.secondaryColor ?? config.secondaryColor,
    fontSize: params.templateConfig?.fontSize ?? config.fontSize,
  };
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-gray-500 dark:text-gray-400">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-2.5 py-1.5 dark:border-gray-800">
      <Label htmlFor={id} className="cursor-pointer text-xs font-normal text-gray-600 dark:text-gray-300">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

/**
 * Mounted only while the dialog is open, so its state starts from the invoice
 * every time and needs no syncing with the params prop.
 */
function PdfPreviewBody({
  title,
  params,
  onDownload,
  onClose,
}: {
  title?: string;
  params: PdfExportParams;
  onDownload: (params: PdfExportParams, bytes?: Uint8Array) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslation();
  const { updateSettings } = useSettingsStore();
  const [paperSize, setPaperSize] = useState<PaperSize>(() => initialPaperSize(params));
  const [config, setConfig] = useState<TemplateConfig>(() => initialConfig(params));
  const [showOptions, setShowOptions] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const updateConfig = (patch: Partial<TemplateConfig>) =>
    setConfig((current) => ({ ...current, ...patch }));
  const updateComponent = (key: keyof TemplateComponents, value: boolean) =>
    setConfig((current) => ({ ...current, components: { ...current.components, [key]: value } }));
  const updateStyle = (key: keyof TemplateStyles, value: boolean | TemplateLogoSize | string) =>
    setConfig((current) => ({ ...current, styles: { ...current.styles, [key]: value } }));

  // `assemblePdfData` reads `template`; colors and type live in the config.
  const exportParams: PdfExportParams = {
    ...params,
    template: config.base,
    paperSize,
    templateConfig: config,
  };
  // Bytes are looked up by these params, so a stale preview can never be saved.
  const exportKey = pdfParamsKey(exportParams);

  const savedKey = JSON.stringify([paperSize, config.base, config.accentColor, config.secondaryColor]);
  const justSaved = lastSaved === savedKey;

  const resetAll = () => {
    setPaperSize(initialPaperSize(params));
    setConfig(initialConfig(params));
  };

  const saveDefaults = () => {
    updateSettings({
      paperSize,
      pdfAccentColor: config.accentColor,
      pdfSecondaryColor: config.secondaryColor,
      template: config.base,
    });
    setLastSaved(savedKey);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await onDownload(exportParams, cachedPdf(exportKey));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <DialogHeader className="gap-3 border-b border-gray-200 px-4 py-4 dark:border-gray-800 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 pr-10 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              {title || t.pdfPreview}
            </DialogTitle>
            <DialogDescription className="mt-1">{t.previewBeforeDownload}</DialogDescription>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-expanded={showOptions}
              aria-controls="pdf-template-options"
              onClick={() => setShowOptions((open) => !open)}
              disabled={downloading}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Options
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showOptions ? "rotate-180" : ""}`} />
            </Button>
            <Select
              value={config.base}
              onValueChange={(v) => updateConfig({ base: v as TemplateType })}
              disabled={downloading}
            >
              <SelectTrigger className="w-full gap-2 sm:w-40" aria-label="Template">
                <LayoutTemplate className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_ORDER.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 px-4 py-2.5 dark:border-gray-800 sm:px-6">
        <Field label="Paper" htmlFor="pdf-paper-size">
          <Select
            value={paperSize}
            onValueChange={(v) => setPaperSize(v as PaperSize)}
            disabled={downloading}
          >
            <SelectTrigger id="pdf-paper-size" className="h-8 w-[5.5rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAPER_SIZES.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Size" htmlFor="pdf-font-size">
          <Select
            value={String(config.fontSize)}
            onValueChange={(v) => updateConfig({ fontSize: Number(v) })}
            disabled={downloading}
          >
            <SelectTrigger id="pdf-font-size" className="h-8 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} pt
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Accent" htmlFor="pdf-accent-color">
          <input
            id="pdf-accent-color"
            type="color"
            value={config.accentColor}
            onChange={(e) => updateConfig({ accentColor: e.target.value })}
            disabled={downloading}
            className={SWATCH_CLASS}
          />
        </Field>

        <Field label="Secondary" htmlFor="pdf-secondary-color">
          <input
            id="pdf-secondary-color"
            type="color"
            value={config.secondaryColor}
            onChange={(e) => updateConfig({ secondaryColor: e.target.value })}
            disabled={downloading}
            className={SWATCH_CLASS}
          />
        </Field>

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-xs text-gray-500 dark:text-gray-400"
            onClick={saveDefaults}
            disabled={downloading || justSaved}
          >
            {justSaved ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Save className="h-3.5 w-3.5" />}
            {justSaved ? "Saved" : "Save as default"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-gray-500 dark:text-gray-400"
            onClick={resetAll}
            disabled={downloading}
          >
            Reset
          </Button>
        </div>
      </div>

      {showOptions && (
        <div
          id="pdf-template-options"
          className="max-h-60 shrink-0 overflow-auto border-b border-gray-200 bg-gray-50/60 px-4 py-3 dark:border-gray-800 dark:bg-gray-950/40 sm:px-6"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="pdf-font" className="text-xs text-gray-500 dark:text-gray-400">
                Typeface
              </Label>
              <Select
                value={config.font}
                onValueChange={(v) => updateConfig({ font: v as TemplateFont })}
                disabled={downloading}
              >
                <SelectTrigger id="pdf-font" className="h-8 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pdf-spacing" className="text-xs text-gray-500 dark:text-gray-400">
                Spacing
              </Label>
              <Select
                value={config.spacing}
                onValueChange={(v) => updateConfig({ spacing: v as TemplateSpacing })}
                disabled={downloading}
              >
                <SelectTrigger id="pdf-spacing" className="h-8 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPACING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pdf-logo-size" className="text-xs text-gray-500 dark:text-gray-400">
                Logo size
              </Label>
              <Select
                value={config.styles.logoSize}
                onValueChange={(v) => updateStyle("logoSize", v as TemplateLogoSize)}
                disabled={downloading}
              >
                <SelectTrigger id="pdf-logo-size" className="h-8 w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOGO_SIZES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-3">
              <Label htmlFor="pdf-document-title" className="text-xs text-gray-500 dark:text-gray-400">
                Document title
              </Label>
              <Input
                id="pdf-document-title"
                value={config.styles.title}
                onChange={(e) => updateStyle("title", e.target.value)}
                placeholder="Invoice / Proforma Invoice (from the invoice type)"
                className="h-8 text-xs"
                disabled={downloading}
              />
            </div>
          </div>

          <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {COMPONENT_OPTIONS.map((option) => (
              <ToggleRow
                key={option.key}
                id={`pdf-component-${option.key}`}
                label={option.label}
                checked={config.components[option.key]}
                onChange={(checked) => updateComponent(option.key, checked)}
                disabled={downloading}
              />
            ))}
            {STYLE_OPTIONS.map((option) => (
              <ToggleRow
                key={option.key}
                id={`pdf-style-${option.key}`}
                label={option.label}
                checked={config.styles[option.key]}
                onChange={(checked) => updateStyle(option.key, checked)}
                disabled={downloading}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-slate-100 p-3 dark:bg-slate-950/50 sm:p-6">
        <div className="mx-auto w-full" style={{ maxWidth: 794 }}>
          <LivePdfPreview params={exportParams} />
        </div>
      </div>

      <DialogFooter className="gap-2 border-t border-gray-200 bg-gray-50/50 px-4 py-4 dark:border-gray-800 dark:bg-gray-950/50 sm:justify-end sm:px-6">
        <Button type="button" variant="outline" className="flex-1 sm:flex-initial" onClick={onClose}>
          {t.close}
        </Button>
        <Button
          type="button"
          className="flex-1 sm:flex-initial"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          {downloading ? t.generating : t.downloadPdf}
        </Button>
      </DialogFooter>
    </>
  );
}

export function PdfPreviewDialog({
  open,
  onOpenChange,
  params,
  onDownload,
  title,
}: PdfPreviewDialogProps) {
  // The content can outlive `open` (exit animation, or a suspended presence), so
  // each opening gets a new key: the body remounts and starts from the invoice's
  // saved settings instead of the previous session's tweaks.
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((count) => count + 1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden sm:rounded-2xl">
        <PdfPreviewBody
          key={session}
          title={title}
          params={params}
          onDownload={onDownload}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
