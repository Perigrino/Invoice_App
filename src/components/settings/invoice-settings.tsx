"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useSettingsStore } from "@/store/settings-store";
import type { PaperSize } from "@/types";

export function InvoiceSettings() {
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div className="space-y-6">
      {/* Required Fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Required Fields</CardTitle>
          <p className="text-sm text-gray-500">
            Toggle fields to show or hide on invoice forms
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { key: "showInvoiceId", label: "Invoice ID" },
              { key: "showDueDate", label: "Due Date" },
              { key: "showCurrency", label: "Currency" },
              { key: "showDiscount", label: "Discount" },
              { key: "showNote", label: "Note" },
            ].map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800"
              >
                <Label className="cursor-pointer">{field.label}</Label>
                <Switch
                  checked={
                    settings[field.key as keyof typeof settings] as boolean
                  }
                  onCheckedChange={(checked) =>
                    updateSettings({ [field.key]: checked })
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PDF Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">PDF Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>PDF Export Directory</Label>
              <Input
                value={settings.pdfDirectory}
                onChange={(e) =>
                  updateSettings({ pdfDirectory: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Default Template</Label>
              <Select
                value={settings.template}
                onValueChange={(v) => updateSettings({ template: v as "business" | "modern" | "minimal" | "professional" | "elegant" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="elegant">Elegant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Paper Size</Label>
              <Select
                value={settings.paperSize}
                onValueChange={(v) => updateSettings({ paperSize: v as PaperSize })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A3">A3</SelectItem>
                  <SelectItem value="A4">A4</SelectItem>
                  <SelectItem value="Letter">Letter</SelectItem>
                  <SelectItem value="Legal">Legal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Format */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Format</Label>
            <Select
              value={settings.dateFormat}
              onValueChange={(v) => updateSettings({ dateFormat: v as "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | "MMMM DD, YYYY" })}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                <SelectItem value="MMMM DD, YYYY">July 30, 2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
