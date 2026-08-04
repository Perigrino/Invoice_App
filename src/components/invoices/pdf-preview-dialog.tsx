"use client";

import { useEffect, useState } from "react";
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
import { FileDown, LayoutTemplate, Loader2 } from "lucide-react";
import { LivePdfPreview } from "./live-pdf-preview";
import { TEMPLATE_ORDER } from "@/lib/templates/presets";
import { useTranslation } from "@/lib/i18n";
import type { PdfExportParams } from "@/lib/pdf/export-invoice";
import type { TemplateType } from "@/types";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: PdfExportParams;
  onDownload: (template: TemplateType) => Promise<void>;
  title?: string;
}

export function PdfPreviewDialog({
  open,
  onOpenChange,
  params,
  onDownload,
  title = "PDF Preview",
}: PdfPreviewDialogProps) {
  const t = useTranslation();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>(
    (params.template as TemplateType) || "modern"
  );
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (open) setSelectedTemplate((params.template as TemplateType) || "modern");
  }, [open, params.template]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await onDownload(selectedTemplate);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="gap-0 border-b border-gray-200 px-6 py-5 dark:border-gray-800">
          <div className="flex items-start justify-between gap-4 pr-10">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-lg">
                {title || t.pdfPreview}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {t.previewBeforeDownload}
              </DialogDescription>
            </div>
            <Select
              value={selectedTemplate}
              onValueChange={(v) => setSelectedTemplate(v as TemplateType)}
              disabled={downloading}
            >
              <SelectTrigger className="w-44 shrink-0 gap-2">
                <LayoutTemplate className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-slate-100 p-6 dark:bg-slate-950/50">
          <div className="mx-auto w-full" style={{ maxWidth: 794 }}>
            <LivePdfPreview params={{ ...params, template: selectedTemplate }} />
          </div>
        </div>

        <DialogFooter className="border-t border-gray-200 bg-gray-50/50 px-6 py-4 dark:border-gray-800 dark:bg-gray-950/50">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t.close}
          </Button>
          <Button type="button" onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {downloading ? t.generating : t.downloadPdf}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
