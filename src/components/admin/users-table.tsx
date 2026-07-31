"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, KeyRound, RefreshCw } from "lucide-react";

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  _count: { invoices: number; clients: number };
}

interface UsersTableProps {
  users: AdminUser[];
  currentUserId: string;
}

export function UsersTable({ users: initialUsers, currentUserId }: UsersTableProps) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!resetUser) return;
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/admin/users/${resetUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setMessage({ type: "success", text: `Password reset for ${resetUser.email}.` });
      setResetUser(null);
      setNewPassword("");
    } else {
      setMessage({ type: "error", text: data.error || "Failed to reset password." });
    }
  }

  async function handleDelete() {
    if (!deleteUser) return;
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/admin/users/${deleteUser.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== deleteUser.id));
      setMessage({ type: "success", text: `Deleted ${deleteUser.email}.` });
      setDeleteUser(null);
    } else {
      setMessage({ type: "error", text: data.error || "Failed to delete user." });
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <p
          className={`text-sm ${
            message.type === "success"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-500"
          }`}
        >
          {message.text}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 pr-4 font-medium">Invoices</th>
                  <th className="pb-2 pr-4 font-medium">Clients</th>
                  <th className="pb-2 pr-4 font-medium">Joined</th>
                  <th className="pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 dark:border-gray-800/60"
                  >
                    <td className="py-3 pr-4 font-medium text-gray-900 dark:text-gray-100">
                      {user.name || "—"}
                      {user.id === currentUserId && (
                        <span className="ml-2 text-xs text-gray-400">(you)</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {user.email}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant={user.role === "admin" ? "default" : "outline"}
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {user._count.invoices}
                    </td>
                    <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                      {user._count.clients}
                    </td>
                    <td className="py-3 pr-4 text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Reset password"
                          onClick={() => {
                            setResetUser(user);
                            setNewPassword("");
                          }}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          title="Delete user"
                          disabled={user.id === currentUserId}
                          onClick={() => setDeleteUser(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-gray-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(resetUser)} onOpenChange={(open) => !open && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="New password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={loading || newPassword.length < 8}
              onClick={handleReset}
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteUser)} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              This will permanently delete {deleteUser?.email} and all of their
              invoices, clients, and settings. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteUser(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={loading}
              onClick={handleDelete}
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
