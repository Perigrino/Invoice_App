"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettingsStore } from "@/store/settings-store";

const currencies = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
];

const separators = [
  { value: "comma", label: "1,999.00" },
  { value: "dot", label: "1.999,000" },
  { value: "space", label: "1 999,000" },
];

export function CurrencySettings() {
  const { settings, updateSettings } = useSettingsStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Currency Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select
              value={settings.currency}
              onValueChange={(v) => updateSettings({ currency: v as "USD" | "EUR" | "GBP" | "GHS" | "CAD" | "NGN" | "ZAR" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} - {c.name} ({c.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Separator Style</Label>
            <Select
              value={settings.separator}
              onValueChange={(v) => updateSettings({ separator: v as "comma" | "dot" | "space" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {separators.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sign Placement</Label>
            <Select
              value={settings.signPlacement}
              onValueChange={(v) => updateSettings({ signPlacement: v as "before" | "after" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="before">Before amount ($ 1,000.00)</SelectItem>
                <SelectItem value="after">After amount (1,000.00 $)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Decimal Places</Label>
            <Select
              value={String(settings.decimalPlaces)}
              onValueChange={(v) =>
                updateSettings({ decimalPlaces: parseInt(v) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} decimal{n !== 1 ? "s" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
