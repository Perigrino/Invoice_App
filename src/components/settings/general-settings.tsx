"use client";

import { useTheme } from "next-themes";
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
import { useSettingsStore } from "@/store/settings-store";

export function GeneralSettings() {
  const { setTheme, resolvedTheme } = useTheme();
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div className="space-y-6">
      {/* Sound */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sound</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={settings.sound}
            onValueChange={(v) => updateSettings({ sound: v as "default" | "chime" | "bell" | "silent" })}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="chime">Chime</SelectItem>
              <SelectItem value="bell">Bell</SelectItem>
              <SelectItem value="silent">Silent</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Language</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={settings.language}
            onValueChange={(v) => updateSettings({ language: v as "en" | "fr" | "es" | "ar" })}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="ar">Arabic</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              <div>
                <Label className="cursor-pointer font-medium">
                  Open PDF After Export
                </Label>
                <p className="text-sm text-gray-500">
                  Automatically open PDF after generation
                </p>
              </div>
              <Switch
                checked={settings.openPdfAfterExport}
                onCheckedChange={(checked) =>
                  updateSettings({ openPdfAfterExport: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              <div>
                <Label className="cursor-pointer font-medium">
                  Auto-save Invoices
                </Label>
                <p className="text-sm text-gray-500">
                  Automatically save invoices every 30 seconds
                </p>
              </div>
              <Switch
                checked={settings.autoSave}
                onCheckedChange={(checked) =>
                  updateSettings({ autoSave: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              <div>
                <Label className="cursor-pointer font-medium">
                  Dark Mode
                </Label>
                <p className="text-sm text-gray-500">
                  Switch to dark theme
                </p>
              </div>
              <Switch
                checked={resolvedTheme === "dark"}
                onCheckedChange={(checked) => {
                  setTheme(checked ? "dark" : "light");
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
