import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminUsers } from "@/components/admin/admin-users";

export const metadata = {
  title: "Users",
};

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (current?.role !== "admin") redirect("/invoices");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Users
          </h1>
          <p className="text-sm text-gray-500">
            Manage accounts and roles
          </p>
        </div>
      </div>
      <AdminUsers users={users} currentUserId={session.user.id} />
    </div>
  );
}
