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
import { useTranslation } from "@/lib/i18n";

export function GeneralSettings() {
  const { setTheme, resolvedTheme } = useTheme();
  const { settings, updateSettings } = useSettingsStore();
  const t = useTranslation();

  return (
    <div className="space-y-6">
      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.language}</CardTitle>
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
          <CardTitle className="text-base">{t.preferences}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              <div>
                <Label className="cursor-pointer font-medium">
                  {t.autoSave}
                </Label>
                <p className="text-sm text-gray-500">
                  {t.autoSaveDesc}
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
                  {t.darkMode}
                </Label>
                <p className="text-sm text-gray-500">
                  {t.darkModeDesc}
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
