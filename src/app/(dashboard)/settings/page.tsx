"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfilesView } from "@/components/settings/profiles-view";
import { InvoiceSettings } from "@/components/settings/invoice-settings";
import { CurrencySettings } from "@/components/settings/currency-settings";
import { GeneralSettings } from "@/components/settings/general-settings";
import { DataSettings } from "@/components/settings/data-settings";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Settings
          </h1>
          <p className="text-sm text-gray-500">
            Manage your application settings
          </p>
        </div>
      </div>

      <Tabs defaultValue="profiles" className="w-full">
        <TabsList className="h-auto w-full flex-wrap justify-start rounded-none border-b border-gray-200 bg-transparent p-0 dark:border-gray-800">
          <TabsTrigger
            value="profiles"
            className="shrink-0 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Profiles
          </TabsTrigger>
          <TabsTrigger
            value="invoice"
            className="shrink-0 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Invoice
          </TabsTrigger>
          <TabsTrigger
            value="currency"
            className="shrink-0 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Currency
          </TabsTrigger>
          <TabsTrigger
            value="general"
            className="shrink-0 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            General
          </TabsTrigger>
          <TabsTrigger
            value="data"
            className="shrink-0 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Data
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="profiles">
            <ProfilesView />
          </TabsContent>
          <TabsContent value="invoice">
            <InvoiceSettings />
          </TabsContent>
          <TabsContent value="currency">
            <CurrencySettings />
          </TabsContent>
          <TabsContent value="general">
            <GeneralSettings />
          </TabsContent>
          <TabsContent value="data">
            <DataSettings />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
