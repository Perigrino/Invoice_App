"use client";

import { useEffect } from "react";
import { useInvoiceStore } from "@/store/invoice-store";
import { useClientStore } from "@/store/client-store";
import { useSettingsStore } from "@/store/settings-store";
import { useCompanyStore } from "@/store/company-store";
import { useProfileStore } from "@/store/profile-store";

export function StorageHydrator() {
  const hydrateInvoices = useInvoiceStore((s) => s.hydrate);
  const hydrateClients = useClientStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const hydrateCompany = useCompanyStore((s) => s.hydrate);
  const hydrateProfiles = useProfileStore((s) => s.hydrate);
  const activeProfileId = useProfileStore((s) => s.activeProfileId);
  const clearNewProfileFlag = useProfileStore((s) => s.clearNewProfileFlag);

  useEffect(() => {
    hydrateProfiles();
  }, [hydrateProfiles]);

  useEffect(() => {
    (async () => {
      await Promise.all([
        hydrateInvoices(),
        hydrateClients(),
        hydrateSettings(),
        hydrateCompany(),
      ]);
      clearNewProfileFlag();
    })();
  }, [hydrateInvoices, hydrateClients, hydrateSettings, hydrateCompany, activeProfileId, clearNewProfileFlag]);
  return null;
}
