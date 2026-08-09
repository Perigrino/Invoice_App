"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteUserAction, updateRoleAction } from "@/app/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AdminUser {
  id: string;
  username: string | null;
  name: string | null;
  email: string;
  role: string;
  emailVerified: Date | null;
  createdAt: Date;
}

export function AdminUsers({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const changeRole = (userId: string, role: string) => {
    setPendingId(userId);
    setMessage(null);
    startTransition(async () => {
      const r = await updateRoleAction(userId, role);
      if (r.error) setMessage(r.error);
      else track("admin_role_changed", { userId, role });
      setPendingId(null);
      router.refresh();
    });
  };

  const remove = (user: AdminUser) => {
    if (!window.confirm(`Delete the account for ${user.email}? This cannot be undone.`))
      return;
    setPendingId(user.id);
    setMessage(null);
    startTransition(async () => {
      const r = await deleteUserAction(user.id);
      if (r.error) setMessage(r.error);
      else track("admin_user_deleted", { userId: user.id });
      setPendingId(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {message && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400">
          {message}
        </p>
      )}
      {users.map((u) => {
        const isSelf = u.id === currentUserId;
        const pending = pendingId === u.id;
        const display = u.username ? `@${u.username}` : u.name || u.email;
        const initials = (u.username || u.name || u.email).slice(0, 2).toUpperCase();

        return (
          <div
            key={u.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950/60"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                  {initials}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {display}
                    </p>
                    {isSelf && <Badge variant="default">You</Badge>}
                    <Badge variant={u.emailVerified ? "paid" : "pending"}>
                      {u.emailVerified ? "Verified" : "Unverified"}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {u.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 lg:justify-end">
                <Select
                  value={u.role}
                  disabled={isSelf || !!pending}
                  onValueChange={(v) => changeRole(u.id, v)}
                >
                  <SelectTrigger className="w-32" aria-label={`Role for ${u.email}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${u.email}`}
                  disabled={isSelf || !!pending}
                  onClick={() => remove(u)}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-red-500" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
