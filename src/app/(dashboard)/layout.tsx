import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getWorkspaceId } from "@/lib/workspace";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspaceId = await getWorkspaceId();
  if (!workspaceId) {
    // Only reachable if src/proxy.ts stopped running for app routes.
    throw new Error(
      "No workspace cookie on this request — the proxy did not run."
    );
  }

  return <DashboardLayout workspaceId={workspaceId}>{children}</DashboardLayout>;
}
