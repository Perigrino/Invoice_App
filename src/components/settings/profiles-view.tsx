"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Check, X, Upload, ImageIcon } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useProfileStore } from "@/store/profile-store";
import { useSettingsStore } from "@/store/settings-store";
import { useCompanyStore } from "@/store/company-store";
import { cn } from "@/lib/utils";
import { imageToSvg } from "@/lib/image-to-svg";

const PRESET_COLORS = [
  "#00BCD4",
  "#059669",
  "#2563EB",
  "#7C3AED",
  "#DB2777",
  "#EA580C",
  "#EAB308",
  "#DC2626",
  "#0F172A",
  "#64748B",
];

function ColorPicker({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <label className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
          <span className="absolute inset-0" style={{ backgroundColor: value }} />
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#00BCD4"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={label}
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-28 font-mono text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => onChange(color)}
            className={cn(
              "h-6 w-6 rounded-full border transition-transform hover:scale-110",
              value.toLowerCase() === color.toLowerCase()
                ? "border-gray-900 ring-2 ring-gray-400 dark:border-white dark:ring-gray-500"
                : "border-gray-300 dark:border-gray-600"
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

export function ProfilesView() {
  const profiles = useProfileStore((s) => s.profiles);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const addProfile = useProfileStore((s) => s.addProfile);
  const deleteProfile = useProfileStore((s) => s.deleteProfile);
  const renameProfile = useProfileStore((s) => s.renameProfile);
  const switchProfile = useProfileStore((s) => s.switchProfile);

  const { settings, updateSettings, reset: resetSettings } = useSettingsStore();
  const { company, updateCompany, reset: resetCompany } = useCompanyStore();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showSaved, setShowSaved] = useState(false);

  const handleAdd = () => {
    if (!newName.trim()) return;
    const profile = addProfile(newName.trim());
    switchProfile(profile.id);
    resetCompany();
    resetSettings();
    setNewName("");
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    renameProfile(id, editName.trim());
    setEditingId(null);
    setEditName("");
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        const svg = await imageToSvg(dataUrl);
        updateSettings({ logo: svg });
      };
      reader.readAsDataURL(file);
    }
  }, [updateSettings]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".svg"] },
    maxFiles: 1,
    noClick: true,
  });

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* LEFT — Profile list */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profiles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New profile name..."
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button type="button" size="sm" onClick={handleAdd}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {profiles.map((p) => {
                const isActive = p.id === activeProfileId;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 transition-colors",
                      isActive
                        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40"
                        : "border-gray-200 dark:border-gray-700"
                    )}
                  >
                    {editingId === p.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(p.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => handleRename(p.id)}>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5 text-gray-400" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          className="flex items-center gap-3"
                          onClick={() => switchProfile(p.id)}
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold",
                              isActive
                                ? "bg-emerald-500 text-white"
                                : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                            )}
                          >
                            {(p.name || "?").charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <p className={cn("text-sm font-medium", isActive && "text-emerald-700 dark:text-emerald-400")}>
                              {p.name}
                            </p>
                            <p className="text-xs text-gray-400">{isActive ? "Active" : "Click to switch"}</p>
                          </div>
                        </button>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => { setEditingId(p.id); setEditName(p.name); }}
                          >
                            <Pencil className="h-3.5 w-3.5 text-gray-400" />
                          </Button>
                          {profiles.length > 1 && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-400 hover:text-red-600"
                              onClick={() => deleteProfile(p.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT — Active profile details */}
      <div className="lg:col-span-2">
        {activeProfile ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-sm font-bold text-white">
                {(activeProfile.name || "?").charAt(0).toUpperCase()}
              </span>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  {activeProfile.name}
                </h2>
                <p className="text-xs text-gray-500">Editing active profile</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company Logo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-6">
                  <div
                    {...getRootProps()}
                    className={`flex h-32 w-32 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                      isDragActive
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <input {...getInputProps()} />
                    {settings.logo ? (
                      <img
                        src={settings.logo}
                        alt="Company logo"
                        className="h-full w-full rounded-lg object-contain p-2"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-400">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-xs">Drop logo</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500">
                      Upload your company logo. Supported formats: PNG, JPG, SVG.
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={open}>
                        <Upload className="h-4 w-4" />
                        Upload Logo
                      </Button>
                      {settings.logo && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateSettings({ logo: "" })}
                          className="text-red-500"
                        >
                          <X className="h-4 w-4" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Business Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={company.fullName} onChange={(e) => updateCompany({ fullName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input value={company.name} onChange={(e) => updateCompany({ name: e.target.value })} />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Address</Label>
                    <Input value={company.address} onChange={(e) => updateCompany({ address: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={company.email} onChange={(e) => updateCompany({ email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={company.phone} onChange={(e) => updateCompany({ phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input value={company.website} onChange={(e) => updateCompany({ website: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">PDF Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <ColorPicker
                    label="Accent Color"
                    value={settings.pdfAccentColor}
                    onChange={(color) => updateSettings({ pdfAccentColor: color })}
                    description="Used for the invoice title, table header, and underline."
                  />
                  <ColorPicker
                    label="Secondary Color"
                    value={settings.pdfSecondaryColor}
                    onChange={(color) => updateSettings({ pdfSecondaryColor: color })}
                    description="Used for the totals section and total highlight."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Default Invoice Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={settings.notes}
                    onChange={(e) => updateSettings({ notes: e.target.value })}
                    placeholder="Enter default notes for all invoices..."
                    rows={4}
                  />
                  <p className="text-xs text-gray-500">
                    These notes will appear on every exported PDF unless overridden by invoice-specific notes.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button type="button" onClick={() => { setShowSaved(true); setTimeout(() => setShowSaved(false), 2000); }}>
                Save Changes
              </Button>
              {showSaved && (
                <span className="text-sm text-emerald-600 font-medium">Saved!</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            No profile selected
          </div>
        )}
      </div>
    </div>
  );
}
