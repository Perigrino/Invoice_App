import { Shield } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/dal";
import { UsersTable, type AdminUser } from "@/components/admin/users-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { invoices: true, clients: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mappedUsers: AdminUser[] = users.map((user) => ({
    ...user,
    createdAt: user.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-gray-400" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            User Accounts
          </h1>
          <p className="text-sm text-gray-500">
            Manage user accounts, reset passwords, and remove users
          </p>
        </div>
      </div>

      <UsersTable users={mappedUsers} currentUserId={admin.id} />
    </div>
  );
}
