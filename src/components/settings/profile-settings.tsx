"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, ImageIcon } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useSettingsStore } from "@/store/settings-store";
import { useCompanyStore } from "@/store/company-store";

export function ProfileSettings() {
  const { settings, updateSettings } = useSettingsStore();
  const { company, updateCompany } = useCompanyStore();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        updateSettings({ logo: dataUrl });
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

  return (
    <div className="space-y-6">
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
    </div>
  );
}
