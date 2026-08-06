import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <DashboardLayout
      user={{
        id: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
      }}
    >
      {children}
    </DashboardLayout>
  );
}
