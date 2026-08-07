import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true, name: true, email: true, role: true },
  });
  if (!user) redirect("/login");

  return (
    <DashboardLayout
      user={{
        id: session.user.id,
        name: user.name ?? "",
        username: user.username ?? undefined,
        email: user.email,
        role: user.role ?? undefined,
      }}
    >
      {children}
    </DashboardLayout>
  );
}
